/**
 * Normalizadores dos valores do CSV do RD Station.
 * Avisos nunca carregam o valor (pode ser dado sensível), só o problema.
 */

export type Valor = string | null | undefined;

/** Recebe avisos de um normalizador. Quem chama acrescenta o contexto (coluna, linha). */
export type Avisar = (mensagem: string) => void;

const semAviso: Avisar = () => {};

const VAZIOS = new Set(['', 'n/a', '-']);

/** Trim, colapsa espaços e trata vazios (`""`, `n/a`, `-`) como `null`. */
export function texto(v: Valor): string | null {
  if (v == null) return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return VAZIOS.has(t.toLowerCase()) ? null : t;
}

export function semAcento(v: string): string {
  return v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function maiusculas(v: Valor): string | null {
  return texto(v)?.toUpperCase() ?? null;
}

export function email(v: Valor): string | null {
  return texto(v)?.toLowerCase() ?? null;
}

const SIM = new Set(['sim', 's', 'yes', 'y']);
const NAO = new Set(['nao', 'n', 'no']);

/** `sim`, `Sim!`, `s`, `yes` → `'Sim'`; `nao`, `Não!`, `n` → `'Não'`; outro → `null`. */
export function simNao(v: Valor): 'Sim' | 'Não' | null {
  const t = texto(v);
  if (!t) return null;
  const base = semAcento(t).replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  if (SIM.has(base)) return 'Sim';
  if (NAO.has(base)) return 'Não';
  return null;
}

/** Texto livre; uma resposta solta de sim/não (ex.: `Não!`) conta como vazio. */
export function descricao(v: Valor): string | null {
  const t = texto(v);
  if (!t || simNao(t) !== null) return null;
  return t;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function dataValida(dia: number, mes: number, ano: number): boolean {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/** `AAAA-MM-DD`, `DD/MM/AAAA`, `D/M/AAAA` ou `DD/MM/AA` → `DD/MM/AAAA`. */
export function data(v: Valor, avisar: Avisar = semAviso, hoje = new Date()): string | null {
  const t = texto(v);
  if (!t) return null;

  let dia: number, mes: number, ano: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (iso) {
    [ano, mes, dia] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (br) {
    [dia, mes, ano] = [Number(br[1]), Number(br[2]), Number(br[3])];
    if (br[3].length === 2) {
      const seculoAtual = hoje.getFullYear() % 100;
      ano += ano <= seculoAtual ? 2000 : 1900;
    }
  } else {
    avisar('formato de data não reconhecido');
    return null;
  }

  if (!dataValida(dia, mes, ano)) {
    avisar('data inválida');
    return null;
  }
  return `${pad2(dia)}/${pad2(mes)}/${ano}`;
}

export function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(digitos[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === Number(digitos[9]) && dv(10) === Number(digitos[10]);
}

export function cpf(v: Valor, avisar: Avisar = semAviso): string | null {
  const t = texto(v);
  if (!t) return null;
  const d = t.replace(/\D/g, '');
  if (d.length !== 11) {
    avisar('não tem 11 dígitos');
    return t;
  }
  if (!cpfValido(d)) avisar('dígito verificador inválido');
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function cep(v: Valor): string | null {
  const t = texto(v);
  if (!t) return null;
  const d = t.replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : t;
}

/**
 * Usa o primeiro número antes de `;`. Número brasileiro vira `(DD) 90000-0000` ou `(DD) 0000-0000`;
 * número de outro país (`+` diferente de `+55`) fica como veio.
 */
export function telefone(v: Valor, avisar: Avisar = semAviso): string | null {
  const t = texto(v?.split(';')[0]);
  if (!t) return null;
  if (t.startsWith('+') && !t.startsWith('+55')) return t;

  let d = t.replace(/\D/g, '');
  if (t.startsWith('+55') || (d.startsWith('55') && (d.length === 12 || d.length === 13))) {
    d = d.slice(2);
  } else if (d.startsWith('0')) {
    // 0 + DDD + número, ou 0 + operadora (2 dígitos) + DDD + número
    if (d.length === 11 || d.length === 12) d = d.slice(1);
    else if (d.length === 13 || d.length === 14) d = d.slice(3);
  }

  if (d.length === 11 && d[2] === '9') return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  avisar('formato de telefone não reconhecido');
  return t;
}

/** Aceita vírgula decimal (`1,65` → `1.65`). */
export function numero(v: Valor, avisar: Avisar = semAviso): number | null {
  const t = texto(v);
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n)) {
    avisar('número inválido');
    return null;
  }
  return n;
}

export function hora(v: Valor): string | null {
  const t = texto(v);
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t);
  return m ? `${pad2(Number(m[1]))}:${m[2]}` : t;
}

/** Separa por `,` ou `;` (ex.: vacinas, idiomas). */
export function lista(v: Valor): string[] | null {
  const itens = (v ?? '').split(/[,;]/).map(texto).filter((i): i is string => i !== null);
  return itens.length ? itens : null;
}

/** Remove nulos, vazios e repetidos e une com `sep`. */
export function juntar(sep: string, ...partes: Valor[]): string | null {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const p of partes) {
    const t = p?.trim();
    if (!t || vistos.has(t)) continue;
    vistos.add(t);
    saida.push(t);
  }
  return saida.length ? saida.join(sep) : null;
}
