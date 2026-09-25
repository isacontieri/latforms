import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFStream, type PDFObject } from 'pdf-lib';
import type { DadosFicha } from '../schema';
import { lerFicha } from './read';

export const TAMANHO_MAXIMO = 5 * 1024 * 1024;

export type MotivoRecusa = 'grande_demais' | 'nao_e_pdf' | 'protegido' | 'corrompido' | 'javascript' | 'nao_e_template' | 'dados_invalidos';

export type ValidacaoPdf = { ok: true; dados: DadosFicha } | { ok: false; motivo: MotivoRecusa; mensagem: string };

const MENSAGENS: Record<MotivoRecusa, string> = {
  grande_demais: 'O arquivo passa de 5 MB. Envie o PDF da ficha que você baixou aqui.',
  nao_e_pdf: 'O arquivo não é um PDF. Envie o PDF da ficha que você baixou aqui.',
  protegido: 'O PDF está protegido por senha. Salve a ficha sem senha e envie de novo.',
  corrompido: 'Não conseguimos abrir o PDF. Salve a ficha de novo (de preferência no Adobe Reader) e envie.',
  javascript: 'O PDF contém conteúdo não permitido. Envie o arquivo da ficha que você baixou aqui, sem alterações no documento.',
  nao_e_template:
    'Este não é o arquivo da ficha que você baixou aqui. Se você editou no Preview do Mac ou no navegador e o erro continuar, use o Adobe Reader.',
  dados_invalidos: 'Algum campo de escolha (lista) está com um valor inválido. Confira as listas e envie de novo.',
};

const recusa = (motivo: MotivoRecusa): ValidacaoPdf => ({ ok: false, motivo, mensagem: MENSAGENS[motivo] });

/** Procura JavaScript em qualquer lugar: ações (/S /JavaScript, /JS), /Names/JavaScript, /OpenAction, /AA. */
export function temJavaScript(pdf: PDFDocument): boolean {
  const JS = PDFName.of('JS');
  const JAVASCRIPT = PDFName.of('JavaScript');
  const S = PDFName.of('S');
  const visto = new Set<PDFObject>();

  const procurar = (o: PDFObject | undefined): boolean => {
    if (!o || visto.has(o)) return false;
    visto.add(o);
    const dict = o instanceof PDFDict ? o : o instanceof PDFStream || o instanceof PDFRawStream ? o.dict : null;
    if (dict) {
      if (dict.has(JS) || dict.has(JAVASCRIPT) || dict.get(S) === JAVASCRIPT) return true;
      for (const [, valor] of dict.entries()) if (procurar(valor)) return true;
    } else if (o instanceof PDFArray) {
      for (let i = 0; i < o.size(); i++) if (procurar(o.get(i))) return true;
    }
    return false; // referências indiretas são visitadas pela enumeração abaixo
  };

  for (const [, obj] of pdf.context.enumerateIndirectObjects()) if (procurar(obj)) return true;
  return procurar(pdf.catalog);
}

/**
 * Validação do PDF devolvido pelo cliente (skill §7): tamanho, assinatura, abre sem senha, sem JavaScript,
 * é a nossa ficha (todos os campos de CAMPOS_FICHA com o tipo certo) e os valores das listas são válidos.
 */
export async function validarPdfDevolvido(bytes: Uint8Array): Promise<ValidacaoPdf> {
  if (bytes.byteLength > TAMANHO_MAXIMO) return recusa('grande_demais');
  if (Buffer.from(bytes.subarray(0, 1024)).toString('latin1').indexOf('%PDF-') === -1) return recusa('nao_e_pdf');

  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    return recusa((e as Error).name === 'EncryptedPDFError' || /encrypt/i.test((e as Error).message) ? 'protegido' : 'corrompido');
  }

  try {
    if (temJavaScript(pdf)) return recusa('javascript');
    const leitura = lerFicha(pdf);
    if (!leitura.ok) return recusa(leitura.motivo);
    return { ok: true, dados: leitura.dados };
  } catch {
    // o pdf-lib abre alguns arquivos quebrados de forma tolerante e só falha ao ler a estrutura
    return recusa('corrompido');
  }
}
