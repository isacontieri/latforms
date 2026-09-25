import { readFileSync } from 'node:fs';
import { PDFDocument, PDFDropdown, PDFName, PDFTextField, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { mapearParaFicha } from '@/lib/ficha/mapping';
import { CAMINHO_TEMPLATE, CAMPOS_PDF, PLACEHOLDER_DROPDOWN } from '@/lib/ficha/pdf/fields';
import { nomeArquivoFicha, preencherFicha } from '@/lib/ficha/pdf/fill';
import { lerFicha, lerFichaDeBytes } from '@/lib/ficha/pdf/read';
import { paraWinAnsi } from '@/lib/ficha/pdf/winansi';
import type { DadosFicha } from '@/lib/ficha/schema';
import { extrairLinha } from '@/lib/rd/extrair';
import { decodificar, parseCsvRd } from '@/lib/rd/parse-csv';

const template = new Uint8Array(readFileSync(new URL(`../../${CAMINHO_TEMPLATE}`, import.meta.url)));
const { linhas } = parseCsvRd(decodificar(readFileSync(new URL('../fixtures/rd-export.csv', import.meta.url))));
const fichaDe = (sufixo: string) => mapearParaFicha(extrairLinha(linhas.find((l) => l.ID.endsWith(sufixo))!).dados.campos);

const vazia: DadosFicha = Object.fromEntries(
  Object.keys(CAMPOS_PDF).map((k) => [k, k.startsWith('vacina') ? false : null]),
) as DadosFicha;

describe('template', () => {
  it('tem os 35 campos com os nomes esperados', async () => {
    const pdf = await PDFDocument.load(template);
    const nomes = new Set(pdf.getForm().getFields().map((f) => f.getName()));
    expect(nomes.size).toBe(35);
    for (const n of Object.values(CAMPOS_PDF)) expect(nomes).toContain(n);
  });
});

describe('preencherFicha → lerFicha (round-trip)', () => {
  it.each(['a01', 'a02', 'a03', 'a04'])('caso %s volta igual', async (id) => {
    const dados = fichaDe(id);
    const { pdf } = await preencherFicha(template, dados);
    const lida = await lerFichaDeBytes(pdf);
    expect(lida).toEqual({ ok: true, dados });
  });

  it('todos os campos preenchidos, com acentos, dropdowns e checkboxes', async () => {
    const dados: DadosFicha = {
      ...fichaDe('a03'),
      cidade: 'Ribeirão Preto',
      estadoCivil: 'Viúvo',
      condicionamentoFisico: 'Razoável',
      diabetico: 'Não',
      disturbioCardioRespiratorio: 'Sim',
      convenioMedico: 'Unimed — plano nacional',
      profissao: 'Engenheiro',
      vacinaTetano: true,
    };
    const { pdf } = await preencherFicha(template, dados);
    expect(await lerFichaDeBytes(pdf)).toEqual({ ok: true, dados });
  });

  it('dropdown vazio fica no placeholder e checkbox desmarcado', async () => {
    const { pdf } = await preencherFicha(template, vazia);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getForm().getDropdown(CAMPOS_PDF.estadoCivil).getSelected()).toEqual([PLACEHOLDER_DROPDOWN]);
    expect(doc.getForm().getCheckBox(CAMPOS_PDF.vacinaCovid).isChecked()).toBe(false);
    expect(lerFicha(doc)).toEqual({ ok: true, dados: vazia });
  });
});

describe('o PDF continua editável', () => {
  it('não achata: os 35 campos continuam existindo e editáveis', async () => {
    const { pdf } = await preencherFicha(template, fichaDe('a03'));
    const doc = await PDFDocument.load(pdf);
    const form = doc.getForm();
    expect(form.getFields()).toHaveLength(35);
    expect(form.getFields().every((f) => !f.isReadOnly())).toBe(true);
    // simula o cliente editando e salvando
    form.getTextField(CAMPOS_PDF.convenioMedico).setText('Bradesco Saúde');
    form.getDropdown(CAMPOS_PDF.estadoCivil).select('Casado');
    const lida = lerFicha(await PDFDocument.load(await doc.save()));
    expect(lida.ok && lida.dados.convenioMedico).toBe('Bradesco Saúde');
    expect(lida.ok && lida.dados.estadoCivil).toBe('Casado');
  });

  it('mantém o JavaScript de data do template (dd/mm/yyyy) nos campos de data', async () => {
    const { pdf } = await preencherFicha(template, fichaDe('a03'));
    const doc = await PDFDocument.load(pdf);
    for (const nome of [CAMPOS_PDF.nascimento, CAMPOS_PDF.vencimentoPassaporte]) {
      expect(doc.getForm().getTextField(nome).acroField.dict.has(PDFName.of('AA'))).toBe(true);
    }
  });
});

describe('textos difíceis', () => {
  it('emoji e outros alfabetos não quebram a geração', async () => {
    const { pdf, avisos } = await preencherFicha(template, {
      ...vazia,
      nomeCompleto: 'Zoë Łukasz 😀',
      outrasObservacoes: 'Viagem → Japão 日本 ✈️',
    });
    const lida = await lerFichaDeBytes(pdf);
    expect(lida.ok && lida.dados.nomeCompleto).toBe('Zoë Lukasz');
    expect(lida.ok && lida.dados.outrasObservacoes).toBe('Viagem -> Japão');
    expect(avisos.some((a) => a.startsWith('nomeCompleto:'))).toBe(true);
    expect(avisos.join()).not.toContain('Łukasz'); // aviso não carrega o conteúdo
  });

  it('texto longo reduz a fonte e avisa quando nem assim cabe', async () => {
    const longo = 'Losartana 50mg, Atenolol 25mg, AAS 100mg, Sinvastatina 20mg, Metformina 850mg, Omeprazol 20mg, '.repeat(3);
    const { pdf, avisos } = await preencherFicha(template, { ...vazia, medicamentoRegular: longo.trim() });
    const doc = await PDFDocument.load(pdf);
    const campo = doc.getForm().getTextField(CAMPOS_PDF.medicamentoRegular);
    expect(campo.getText()).toBe(longo.trim()); // nunca corta o valor
    expect(avisos.some((a) => a.startsWith('medicamentoRegular:'))).toBe(true);
  });

  it('texto curto mantém 10 pt', async () => {
    const { pdf } = await preencherFicha(template, { ...vazia, estado: 'SP' });
    const doc = await PDFDocument.load(pdf);
    const da = doc.getForm().getTextField(CAMPOS_PDF.estado).acroField.getDefaultAppearance() ?? '';
    expect(da).toMatch(/\b10 Tf\b/);
  });
});

describe('paraWinAnsi', async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  it('mantém acentos do português', () => {
    expect(paraWinAnsi(font, 'Não, Ribeirão, Viúvo, ç', false)).toEqual({ texto: 'Não, Ribeirão, Viúvo, ç', removidos: 0 });
  });
  it('troca quebra de linha em campo de uma linha', () => {
    expect(paraWinAnsi(font, 'a\nb', false).texto).toBe('a — b');
    expect(paraWinAnsi(font, 'a\r\nb', true).texto).toBe('a\nb');
  });
});

describe('nomeArquivoFicha', () => {
  const data = new Date('2026-09-25T02:00:00Z'); // 23h do dia 24 em São Paulo
  it('usa primeiro e último nome, sem acento, com a data de São Paulo', () => {
    expect(nomeArquivoFicha('Antônio Ribeiro Neto', data)).toBe('Ficha_Cadastro_Antonio_Neto_2026-09-24.pdf');
  });
  it('nome vazio', () => expect(nomeArquivoFicha(null, data)).toBe('Ficha_Cadastro_Cliente_2026-09-24.pdf'));
});

describe('lerFicha', () => {
  it('recusa PDF que não é o template', async () => {
    const outro = await PDFDocument.create();
    outro.addPage();
    outro.getForm().createTextField('qualquer').addToPage(outro.getPage(0));
    expect(lerFicha(outro)).toEqual({ ok: false, motivo: 'nao_e_template' });
  });

  it('valor de dropdown fora das opções não entra no PDF', async () => {
    const { avisos, pdf } = await preencherFicha(template, { ...vazia, estadoCivil: 'Enrolado' as DadosFicha['estadoCivil'] });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getForm().getField(CAMPOS_PDF.estadoCivil)).toBeInstanceOf(PDFDropdown);
    expect(doc.getForm().getDropdown(CAMPOS_PDF.estadoCivil).getSelected()).toEqual([PLACEHOLDER_DROPDOWN]);
    expect(avisos).toContain('estadoCivil: valor fora das opções do PDF');
    expect(doc.getForm().getField(CAMPOS_PDF.nomeCompleto)).toBeInstanceOf(PDFTextField);
  });
});
