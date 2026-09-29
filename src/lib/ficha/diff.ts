/**
 * Quando um campo conta como "alterado" (amarelo no painel): valor atual ≠ valor original do RD,
 * ignorando espaços nas pontas e tratando vazio ("", "  ", null, undefined) como igual.
 * Campo alterado e depois revertido ao original NÃO fica amarelo; o histórico registra a ida e a volta.
 */
export function normalizarValor(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v).replace(/\r\n?/g, '\n').trim();
  return s === '' ? null : s;
}

export function igual(a: unknown, b: unknown): boolean {
  return normalizarValor(a) === normalizarValor(b);
}

export function camposAlterados(atuais: Record<string, unknown>, originais: Record<string, unknown>): Set<string> {
  const chaves = new Set([...Object.keys(atuais), ...Object.keys(originais)]);
  return new Set([...chaves].filter((k) => !igual(atuais[k], originais[k])));
}
