import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument, PDFDropdown, PDFTextField, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { CAMPOS_FICHA, SECOES_FICHA } from '@/lib/ficha/campos';
import { mapearParaFicha } from '@/lib/ficha/mapping';
import { MODELO_FICHA, PLACEHOLDER_DROPDOWN, gerarFicha, nomeArquivoFicha, type RecursosFicha } from '@/lib/ficha/pdf/gerar';
import { lerFicha, lerFichaDeBytes } from '@/lib/ficha/pdf/read';
import { paraWinAnsi } from '@/lib/ficha/pdf/winansi';
import type { DadosFicha } from '@/lib/ficha/schema';
import { extrairLinha } from '@/lib/rd/extrair';
import { decodificar, parseCsvRd } from '@/lib/rd/parse-csv';

const arq = (p: string) => new Uint8Array(readFileSync(new URL(`../../${p}`, import.meta.url)));
const recursos: RecursosFicha = {
  fonteRegular: arq('assets/fonts/OpenSans-Regular.ttf'),
  fonteNegrito: arq('assets/fonts/OpenSans-Bold.ttf'),
  fonteItalico: arq('assets/fonts/OpenSans-Italic.ttf'),
  logoPng: arq('assets/templates/logo-latitudes.png'),
};
const { linhas } = parseCsvRd(decodificar(readFileSync(new URL('../fixtures/rd-export.csv', import.meta.url))));
const fichaDe = (sufixo: string) => mapearParaFicha(extrairLinha(linhas.find((l) => l.ID.endsWith(sufixo))!).dados.campos);
const vazia = Object.fromEntries(CAMPOS_FICHA.map((c) => [c.chave, null])) as DadosFicha;

describe('definição da ficha', () => {
  it('71 campos: 66 do RD + 5 do modelo de 2024', () => {
    expect(CAMPOS_FICHA).toHaveLength(71);
    expect(CAMPOS_FICHA.filter((c) => c.origem === null).map((c) => c.chave).sort()).toEqual(
      ['condicionamentoFisico', 'convenioMedico', 'diabetico', 'disturbioCardioRespiratorio', 'estadoCivil'],
    );
  });

  it('toda chave aparece exatamente uma vez nas seções, e nenhuma linha passa de 12 colunas', () => {
    const nasSecoes = SECOES_FICHA.flatMap((s) => s.linhas.flat());
    expect(nasSecoes.sort()).toEqual(CAMPOS_FICHA.map((c) => c.chave).sort());
    for (const s of SECOES_FICHA) {
      for (const l of s.linhas) {
        const soma = l.reduce((n, k) => n + CAMPOS_FICHA.find((c) => c.chave === k)!.colunas, 0);
        expect(soma, `${s.titulo}: ${l.join(', ')}`).toBeLessThanOrEqual(12);
      }
    }
  });

  it('nunca inclui "Observações para uso interno"', () => {
    expect(CAMPOS_FICHA.some((c) => (c.origem as string | null) === 'observacoesInternas')).toBe(false);
  });
});

describe('gerarFicha → lerFicha (round-trip)', () => {
  it.each(['a01', 'a02', 'a03', 'a04'])('caso %s volta igual', async (id) => {
    const dados = fichaDe(id);
    const { pdf } = await gerarFicha(dados, recursos);
    expect(await lerFichaDeBytes(pdf)).toEqual({ ok: true, dados });
  });

  it('todos os campos preenchidos, com acentos e dropdowns', async () => {
    const dados = {
      ...fichaDe('a03'),
      cidade: 'Ribeirão Preto',
      estadoCivil: 'Viúvo',
      condicionamentoFisico: 'Razoável',
      diabetico: 'Não',
      disturbioCardioRespiratorio: 'Sim',
      convenioMedico: 'Unimed — plano nacional',
      comentarios: 'Linha 1\nLinha 2 com ç e ã',
    } as DadosFicha;
    const { pdf } = await gerarFicha(dados, recursos);
    expect(await lerFichaDeBytes(pdf)).toEqual({ ok: true, dados });

    if (process.env.EXEMPLO_PDF) writeFileSync(process.env.EXEMPLO_PDF, pdf); // para conferir o visual
  });

  it('ficha vazia: dropdowns no placeholder', async () => {
    const { pdf } = await gerarFicha(vazia, recursos);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getForm().getDropdown('estadoCivil').getSelected()).toEqual([PLACEHOLDER_DROPDOWN]);
    expect(doc.getForm().getDropdown('sabeNadar').getSelected()).toEqual([PLACEHOLDER_DROPDOWN]);
    expect(lerFicha(doc)).toEqual({ ok: true, dados: vazia });
  });
});

describe('o PDF continua editável', () => {
  it('71 campos editáveis, com o tipo certo, e várias páginas A4', async () => {
    const { pdf } = await gerarFicha(fichaDe('a03'), recursos);
    const doc = await PDFDocument.load(pdf);
    const form = doc.getForm();
    expect(form.getFields()).toHaveLength(71);
    expect(form.getFields().every((f) => !f.isReadOnly())).toBe(true);
    for (const c of CAMPOS_FICHA) {
      const tipo = c.tipo === 'simNao' || c.tipo === 'opcoes' ? PDFDropdown : PDFTextField;
      expect(form.getField(c.chave), c.chave).toBeInstanceOf(tipo);
    }
    expect(form.getTextField('comentarios').isMultiline()).toBe(true);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(doc.getPages().every((p) => Math.round(p.getWidth()) === 595 && Math.round(p.getHeight()) === 842)).toBe(true);
    expect(doc.getSubject()).toBe(MODELO_FICHA);
  });

  it('cliente edita e salva: a leitura pega as mudanças', async () => {
    const { pdf } = await gerarFicha(fichaDe('a01'), recursos);
    const doc = await PDFDocument.load(pdf);
    doc.getForm().getTextField('convenioMedico').setText('Bradesco Saúde');
    doc.getForm().getDropdown('estadoCivil').select('Casado');
    doc.getForm().getDropdown('sabeNadar').select('Não');
    const lida = lerFicha(await PDFDocument.load(await doc.save()));
    expect(lida.ok && [lida.dados.convenioMedico, lida.dados.estadoCivil, lida.dados.sabeNadar]).toEqual([
      'Bradesco Saúde', 'Casado', 'Não',
    ]);
  });
});

describe('textos difíceis', () => {
  it('emoji e outros alfabetos não quebram a geração; aviso não carrega o conteúdo', async () => {
    const { pdf, avisos } = await gerarFicha({ ...vazia, nome: 'Zoë Łukasz 😀', comentarios: 'Viagem → Japão 日本' }, recursos);
    const lida = await lerFichaDeBytes(pdf);
    expect(lida.ok && lida.dados.nome).toBe('Zoë Lukasz');
    expect(lida.ok && lida.dados.comentarios).toBe('Viagem -> Japão');
    expect(avisos.some((a) => a.startsWith('nome:'))).toBe(true);
    expect(avisos.join()).not.toContain('Łukasz');
  });

  it('texto longo nunca é cortado', async () => {
    const longo = 'Losartana 50mg, Atenolol 25mg, AAS 100mg, Sinvastatina 20mg, Metformina 850mg, Omeprazol 20mg. '.repeat(20).trim();
    const { pdf, avisos } = await gerarFicha({ ...vazia, medicamentosDescricao: longo }, recursos);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getForm().getTextField('medicamentosDescricao').getText()).toBe(longo);
    expect(avisos.some((a) => a.startsWith('medicamentosDescricao:'))).toBe(true);
  });

  it('valor fora das opções não entra no dropdown', async () => {
    const { pdf, avisos } = await gerarFicha({ ...vazia, estadoCivil: 'Enrolado' }, recursos);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getForm().getDropdown('estadoCivil').getSelected()).toEqual([PLACEHOLDER_DROPDOWN]);
    expect(avisos).toContain('estadoCivil: valor fora das opções do PDF');
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
  it('recusa PDF que não é a nossa ficha', async () => {
    const outro = await PDFDocument.create();
    outro.addPage();
    outro.getForm().createTextField('qualquer').addToPage(outro.getPage(0));
    expect(lerFicha(outro)).toEqual({ ok: false, motivo: 'nao_e_template' });
  });

  it('recusa o modelo antigo de 2024', async () => {
    const antigo = await PDFDocument.load(arq('docs/modelo-2024/ficha-cadastro-2024.pdf'));
    expect(lerFicha(antigo)).toEqual({ ok: false, motivo: 'nao_e_template' });
  });
});
