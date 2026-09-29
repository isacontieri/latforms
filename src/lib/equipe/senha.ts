/**
 * Regra de senha das consultoras — a mesma configurada no Supabase Auth (`supabase/config.toml`):
 * mínimo 8 caracteres, com letra maiúscula, minúscula, número e caractere especial.
 * Usada no navegador (feedback) e no servidor (a criação pela API de admin não aplica a regra sozinha).
 */
export function problemasDaSenha(senha: string): string[] {
  const p: string[] = [];
  if (senha.length < 8) p.push('ter pelo menos 8 caracteres');
  if (!/[A-Z]/.test(senha)) p.push('ter uma letra maiúscula');
  if (!/[a-z]/.test(senha)) p.push('ter uma letra minúscula');
  if (!/[0-9]/.test(senha)) p.push('ter um número');
  if (!/[^A-Za-z0-9]/.test(senha)) p.push('ter um caractere especial (ex.: # @ ! %)');
  return p;
}

export function mensagemSenha(problemas: string[]): string | null {
  return problemas.length ? `A senha precisa ${problemas.join(', ')}.` : null;
}
