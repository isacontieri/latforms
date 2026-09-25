import { PDFDocument, PDFDropdown, PDFTextField } from 'pdf-lib';
import { CAMPOS_FICHA } from '../campos';
import { DadosFichaSchema, type DadosFicha } from '../schema';
import { PLACEHOLDER_DROPDOWN } from './gerar';

export type LeituraFicha =
  | { ok: true; dados: DadosFicha }
  | { ok: false; motivo: 'nao_e_template' | 'dados_invalidos' };

/** Nomes de todos os campos de formulário do PDF (para conferir se é a nossa ficha). */
export function nomesDosCampos(pdf: PDFDocument): Set<string> {
  return new Set(pdf.getForm().getFields().map((f) => f.getName()));
}

/**
 * Lê os campos da ficha de um PDF já carregado. Não valida tamanho, assinatura nem JavaScript —
 * isso é da validação do upload (Fase 6).
 */
export function lerFicha(pdf: PDFDocument): LeituraFicha {
  const nomes = nomesDosCampos(pdf);
  if (!CAMPOS_FICHA.every((c) => nomes.has(c.chave))) return { ok: false, motivo: 'nao_e_template' };

  const form = pdf.getForm();
  const dados: Record<string, string | null> = {};
  for (const { chave } of CAMPOS_FICHA) {
    const campo = form.getField(chave);
    if (campo instanceof PDFTextField) {
      dados[chave] = campo.getText()?.trim() || null;
    } else if (campo instanceof PDFDropdown) {
      const sel = campo.getSelected()[0];
      dados[chave] = !sel || sel === PLACEHOLDER_DROPDOWN ? null : sel;
    } else {
      return { ok: false, motivo: 'nao_e_template' };
    }
  }

  const r = DadosFichaSchema.safeParse(dados);
  return r.success ? { ok: true, dados: r.data } : { ok: false, motivo: 'dados_invalidos' };
}

export async function lerFichaDeBytes(bytes: Uint8Array): Promise<LeituraFicha> {
  return lerFicha(await PDFDocument.load(bytes));
}
