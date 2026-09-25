import { PDFCheckBox, PDFDocument, PDFDropdown, PDFTextField, StandardFonts, type PDFFont } from 'pdf-lib';
import { semAcento } from '../normalizers';
import type { DadosFicha } from '../schema';
import { CAMPOS_PDF, PLACEHOLDER_DROPDOWN } from './fields';
import { paraWinAnsi } from './winansi';

const FONTE_PADRAO = 10;
const FONTE_MINIMA = 6;

export interface FichaGerada {
  pdf: Uint8Array;
  /** Avisos sem conteúdo dos campos (só o nome do campo e o problema). */
  avisos: string[];
}

/**
 * Preenche o template com os dados. Nunca redesenha a página e NUNCA chama `form.flatten()`:
 * o cliente precisa continuar editando os campos.
 */
export async function preencherFicha(template: Uint8Array, d: DadosFicha): Promise<FichaGerada> {
  const pdf = await PDFDocument.load(template);
  const form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica); // WinAnsi: cobre acentos PT-BR
  const avisos: string[] = [];

  for (const [chave, nome] of Object.entries(CAMPOS_PDF) as [keyof DadosFicha, string][]) {
    const valor = d[chave];
    const campo = form.getField(nome);

    if (campo instanceof PDFTextField) {
      const { texto, removidos } = paraWinAnsi(font, (valor as string | null) ?? '', campo.isMultiline());
      if (removidos) avisos.push(`${chave}: ${removidos} caractere(s) não suportado(s) pelo PDF foram removidos`);
      campo.setText(texto);
      if (!ajustarFonte(campo, texto, font)) avisos.push(`${chave}: texto longo não cabe inteiro no campo (o leitor rola)`);
    } else if (campo instanceof PDFDropdown) {
      const opcoes = campo.getOptions();
      if (typeof valor === 'string' && opcoes.includes(valor)) campo.select(valor);
      else {
        if (valor) avisos.push(`${chave}: valor fora das opções do PDF`);
        if (opcoes.includes(PLACEHOLDER_DROPDOWN)) campo.select(PLACEHOLDER_DROPDOWN);
        else campo.clear();
      }
    } else if (campo instanceof PDFCheckBox) {
      if (valor) campo.check();
      else campo.uncheck();
    }
  }

  form.updateFieldAppearances(font);
  // NUNCA: form.flatten()

  if (d.nomeCompleto) pdf.setTitle(`Ficha de Cadastro — ${paraWinAnsi(font, d.nomeCompleto, false).texto}`);
  pdf.setProducer('LatForms — Latitudes');
  pdf.setCreator('LatForms');
  return { pdf: await pdf.save(), avisos };
}

/** Reduz a fonte (até 6 pt) para o texto caber no widget. Devolve false se nem assim couber. */
function ajustarFonte(campo: PDFTextField, texto: string, font: PDFFont): boolean {
  const widget = campo.acroField.getWidgets()[0];
  if (!widget || !texto) {
    campo.setFontSize(FONTE_PADRAO);
    return true;
  }
  const { width, height } = widget.getRectangle();
  const larguraUtil = Math.max(width - 4, 1);
  const alturaUtil = Math.max(height - 2, 1);

  const cabe = (tamanho: number) => {
    if (!campo.isMultiline()) return font.widthOfTextAtSize(texto, tamanho) <= larguraUtil;
    const linhas = texto
      .split('\n')
      .reduce((n, par) => n + Math.max(1, Math.ceil(font.widthOfTextAtSize(par, tamanho) / larguraUtil)), 0);
    return linhas * tamanho * 1.15 <= alturaUtil;
  };

  for (let tamanho = FONTE_PADRAO; tamanho >= FONTE_MINIMA; tamanho -= 0.5) {
    if (cabe(tamanho)) {
      campo.setFontSize(tamanho);
      return true;
    }
  }
  campo.setFontSize(FONTE_MINIMA);
  return false;
}

/** `Ficha_Cadastro_<Nome_Sobrenome>_<AAAA-MM-DD>.pdf` (data em São Paulo). */
export function nomeArquivoFicha(nome: string | null, data = new Date()): string {
  const partes = semAcento(nome ?? '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const curto = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes;
  const nomeArq = curto.map((p) => p[0].toUpperCase() + p.slice(1)).join('_') || 'Cliente';
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(data); // AAAA-MM-DD
  return `Ficha_Cadastro_${nomeArq}_${dia}.pdf`;
}
