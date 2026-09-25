import type { PDFFont } from 'pdf-lib';

export interface TextoWinAnsi {
  texto: string;
  /** Quantos caracteres não puderam ser representados (emoji, outros alfabetos…). */
  removidos: number;
}

/** Letras que não se decompõem em base + acento (NFD não resolve). */
const TRANSLITERACAO: Record<string, string> = {
  Ł: 'L', ł: 'l', Đ: 'D', đ: 'd', Ħ: 'H', ħ: 'h', ı: 'i', Ŀ: 'L', ŀ: 'l', ŉ: "'n", ß: 'ss',
  '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '−': '-', '‐': '-', '‑': '-',
};

const cacheConjuntos = new WeakMap<PDFFont, Set<number>>();

function conjunto(font: PDFFont): Set<number> {
  let s = cacheConjuntos.get(font);
  if (!s) {
    s = new Set(font.getCharacterSet());
    cacheConjuntos.set(font, s);
  }
  return s;
}

/**
 * A Helvetica padrão só codifica WinAnsi e o pdf-lib lança erro com qualquer outro caractere.
 * Tenta a versão sem acento; se ainda não der, remove. Em campo de uma linha, quebra de linha vira " — ".
 */
export function paraWinAnsi(font: PDFFont, texto: string, multilinha: boolean): TextoWinAnsi {
  const aceitos = conjunto(font);
  let removidos = 0;
  let saida = '';

  const normalizado = texto
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n/g, multilinha ? '\n' : ' — ');

  for (const ch of normalizado) {
    if (ch === '\n' || aceitos.has(ch.codePointAt(0)!)) {
      saida += ch;
      continue;
    }
    const base = TRANSLITERACAO[ch] ?? ch.normalize('NFD').replace(/\p{M}/gu, '');
    if (base && [...base].every((b) => aceitos.has(b.codePointAt(0)!))) {
      saida += base;
    } else {
      removidos++;
    }
  }
  return { texto: saida.replace(/ {2,}/g, ' ').trim(), removidos };
}
