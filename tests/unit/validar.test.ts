import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { CAMPOS_FICHA } from '@/lib/ficha/campos';
import { gerarFicha, type RecursosFicha } from '@/lib/ficha/pdf/gerar';
import { TAMANHO_MAXIMO, temJavaScript, validarPdfDevolvido } from '@/lib/ficha/pdf/validar';
import type { DadosFicha } from '@/lib/ficha/schema';

const arq = (p: string) => new Uint8Array(readFileSync(new URL(`../../${p}`, import.meta.url)));
const recursos: RecursosFicha = {
  fonteRegular: arq('assets/fonts/OpenSans-Regular.ttf'),
  fonteNegrito: arq('assets/fonts/OpenSans-Bold.ttf'),
  fonteItalico: arq('assets/fonts/OpenSans-Italic.ttf'),
  logoPng: arq('assets/templates/logo-latitudes.png'),
};
const vazia = Object.fromEntries(CAMPOS_FICHA.map((c) => [c.chave, null])) as DadosFicha;
const gerar = async (d: Partial<DadosFicha> = {}) => (await gerarFicha({ ...vazia, nome: 'Ana Teste', ...d }, recursos)).pdf;

describe('validarPdfDevolvido', () => {
  it('aceita a ficha gerada, preenchida e salva pelo cliente', async () => {
    const doc = await PDFDocument.load(await gerar());
    doc.getForm().getTextField('convenioMedico').setText('Unimed');
    doc.getForm().getDropdown('estadoCivil').select('Casado');
    const r = await validarPdfDevolvido(await doc.save());
    expect(r.ok && [r.dados.nome, r.dados.convenioMedico, r.dados.estadoCivil]).toEqual(['Ana Teste', 'Unimed', 'Casado']);
  });

  it('o PDF que o sistema gera não tem JavaScript', async () => {
    expect(temJavaScript(await PDFDocument.load(await gerar()))).toBe(false);
  });

  it('recusa arquivo acima de 5 MB', async () => {
    expect(await validarPdfDevolvido(new Uint8Array(TAMANHO_MAXIMO + 1))).toMatchObject({ ok: false, motivo: 'grande_demais' });
  });

  it('recusa arquivo que não é PDF', async () => {
    expect(await validarPdfDevolvido(new TextEncoder().encode('isto não é um pdf'))).toMatchObject({ ok: false, motivo: 'nao_e_pdf' });
  });

  it('recusa PDF corrompido', async () => {
    expect(await validarPdfDevolvido(new TextEncoder().encode('%PDF-1.7\nlixo'))).toMatchObject({ ok: false });
  });

  it('recusa PDF que não é a nossa ficha (inclusive o modelo antigo de 2024)', async () => {
    const outro = await PDFDocument.create();
    outro.addPage();
    expect(await validarPdfDevolvido(await outro.save())).toMatchObject({ ok: false, motivo: 'nao_e_template' });
    expect(await validarPdfDevolvido(arq('docs/modelo-2024/ficha-cadastro-2024.pdf'))).toMatchObject({ ok: false });
  });

  it('recusa JavaScript no /OpenAction', async () => {
    const doc = await PDFDocument.load(await gerar());
    doc.catalog.set(PDFName.of('OpenAction'), doc.context.obj({ S: 'JavaScript', JS: PDFString.of('app.alert(1)') }));
    expect(await validarPdfDevolvido(await doc.save())).toMatchObject({ ok: false, motivo: 'javascript' });
  });

  it('recusa JavaScript escondido na ação /AA de um campo', async () => {
    const doc = await PDFDocument.load(await gerar());
    const widget = doc.getForm().getTextField('cpf').acroField.getWidgets()[0];
    widget.dict.set(PDFName.of('AA'), doc.context.obj({ K: { S: 'JavaScript', JS: PDFString.of('x()') } }));
    expect(await validarPdfDevolvido(await doc.save())).toMatchObject({ ok: false, motivo: 'javascript' });
  });

  it('recusa JavaScript em /Names', async () => {
    const doc = await PDFDocument.load(await gerar());
    doc.catalog.set(PDFName.of('Names'), doc.context.obj({ JavaScript: { Names: [] } }));
    expect(await validarPdfDevolvido(await doc.save())).toMatchObject({ ok: false, motivo: 'javascript' });
  });

  it('mensagem de recusa é amigável e não expõe dados', async () => {
    const r = await validarPdfDevolvido(new TextEncoder().encode('x'));
    expect(!r.ok && r.mensagem).toMatch(/Envie o PDF da ficha/);
  });
});
