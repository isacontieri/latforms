import Papa from 'papaparse';
import { normalizarCabecalho } from './colunas';

/**
 * Parse do CSV exportado do RD Station. Roda no navegador (e nos testes).
 * Não normaliza valores: isso é feito no servidor, em `extrair.ts`.
 */

export type LinhaCsv = Record<string, string>;

export interface CsvRd {
  /** Cabeçalhos normalizados, únicos, na ordem do arquivo. */
  cabecalhos: string[];
  linhas: LinhaCsv[];
  /** Problemas estruturais (ex.: linha com número errado de colunas), sem conteúdo das células. */
  erros: string[];
}

/** UTF-8 (com ou sem BOM); se não for UTF-8 válido, windows-1252. */
export function decodificar(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export function parseCsvRd(conteudo: string): CsvRd {
  let texto = conteudo.replace(/^﻿/, '');

  let delimitador = ',';
  const sep = /^sep=(.?)\r?\n/i.exec(texto);
  if (sep) {
    delimitador = sep[1] || ',';
    texto = texto.slice(sep[0].length);
  }

  const res = Papa.parse<string[]>(texto, { delimiter: delimitador, skipEmptyLines: 'greedy' });
  const erros = res.errors.map((e) => `linha ${(e.row ?? 0) + 2}: ${e.message}`);
  const [cabecalhoBruto, ...dados] = res.data;
  if (!cabecalhoBruto) return { cabecalhos: [], linhas: [], erros: [...erros, 'arquivo sem cabeçalho'] };

  const cabecalhosPorPosicao = cabecalhoBruto.map(normalizarCabecalho);
  const cabecalhos = [...new Set(cabecalhosPorPosicao.filter(Boolean))];

  const linhas = dados.map((celulas, i) => {
    if (celulas.length !== cabecalhosPorPosicao.length) {
      erros.push(`linha ${i + 3}: ${celulas.length} colunas, esperado ${cabecalhosPorPosicao.length}`);
    }
    const linha: LinhaCsv = {};
    cabecalhosPorPosicao.forEach((h, j) => {
      if (!h) return;
      const v = celulas[j] ?? '';
      // cabeçalhos que ficam iguais depois de normalizados: vale o primeiro valor não vazio
      if (!(h in linha) || (!linha[h].trim() && v.trim())) linha[h] = v;
    });
    return linha;
  });

  return { cabecalhos, linhas, erros };
}
