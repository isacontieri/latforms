import { PDFCheckBox, PDFDocument, PDFDropdown, PDFTextField } from 'pdf-lib';
import { DadosFichaSchema, type DadosFicha } from '../schema';
import { CAMPOS_PDF, PLACEHOLDER_DROPDOWN } from './fields';

export type LeituraFicha =
  | { ok: true; dados: DadosFicha }
  | { ok: false; motivo: 'nao_e_template' | 'dados_invalidos' };

/** Nomes de todos os campos de formulário do PDF (para conferir se é o nosso template). */
export function nomesDosCampos(pdf: PDFDocument): Set<string> {
  return new Set(pdf.getForm().getFields().map((f) => f.getName()));
}

/**
 * Lê os 35 campos da ficha de um PDF já carregado. Não valida tamanho, assinatura nem JavaScript —
 * isso é da validação do upload (Fase 6).
 */
export function lerFicha(pdf: PDFDocument): LeituraFicha {
  const nomes = nomesDosCampos(pdf);
  if (!Object.values(CAMPOS_PDF).every((n) => nomes.has(n))) return { ok: false, motivo: 'nao_e_template' };

  const form = pdf.getForm();
  const dados: Record<string, unknown> = {};
  for (const [chave, nome] of Object.entries(CAMPOS_PDF)) {
    const campo = form.getField(nome);
    if (campo instanceof PDFTextField) {
      dados[chave] = campo.getText()?.trim() || null;
    } else if (campo instanceof PDFDropdown) {
      const sel = campo.getSelected()[0];
      dados[chave] = !sel || sel === PLACEHOLDER_DROPDOWN ? null : sel;
    } else if (campo instanceof PDFCheckBox) {
      dados[chave] = campo.isChecked();
    }
  }

  const r = DadosFichaSchema.safeParse(dados);
  return r.success ? { ok: true, dados: r.data } : { ok: false, motivo: 'dados_invalidos' };
}

export async function lerFichaDeBytes(bytes: Uint8Array): Promise<LeituraFicha> {
  return lerFicha(await PDFDocument.load(bytes));
}
