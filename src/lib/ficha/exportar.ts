import Papa from 'papaparse';
import { CAMPOS_LAYOUT } from './layout';
import { ROTULO_STATUS, type StatusFicha } from './status';

export interface FichaExportada {
  rdId: string;
  status: StatusFicha;
  concluidaEm: string | null;
  atualizadoEm: string;
  dados: Record<string, unknown>;
}

/** Status que podem ser exportados (cancelada fica de fora). */
export const STATUS_EXPORTAVEIS: StatusFicha[] = ['concluida', 'aprovada', 'em_preenchimento', 'aberta', 'enviada', 'gerada'];

const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

/**
 * Evita injeção de fórmula ao abrir no Excel: células que começam com = @ tab/CR, ou + / - que não
 * sejam número/telefone, ganham um apóstrofo na frente.
 */
export function celulaSegura(v: string): string {
  return /^[=@\t\r]/.test(v) || /^[+-](?![\d\s(])/.test(v) ? `'${v}` : v;
}

/**
 * CSV das fichas (uma linha por ficha, uma coluna por campo do layout, na ordem da ficha).
 * Separador ";" e BOM UTF-8, para o Excel em português abrir com acentos certos.
 */
export function montarCsv(fichas: FichaExportada[]): string {
  const cabecalho = ['ID RD', 'Situação', 'Concluída em', 'Atualizada em', ...CAMPOS_LAYOUT.map((c) => c.rotulo)];
  const linhas = fichas.map((f) => [
    f.rdId,
    ROTULO_STATUS[f.status],
    f.concluidaEm ? dataHora.format(new Date(f.concluidaEm)) : '',
    dataHora.format(new Date(f.atualizadoEm)),
    ...CAMPOS_LAYOUT.map((c) => {
      const v = f.dados[c.chave];
      return v === null || v === undefined ? '' : celulaSegura(String(v));
    }),
  ]);
  return '﻿' + Papa.unparse([cabecalho, ...linhas], { delimiter: ';', newline: '\r\n', quotes: true });
}
