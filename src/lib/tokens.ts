import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

/** Token de link (cliente ou equipe): 32 bytes aleatórios. Só o hash vai para o banco. */
export const gerarToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/** Formato de um token gerado por `gerarToken` (evita consultar o banco com lixo). */
export const tokenValido = (t: string) => /^[A-Za-z0-9_-]{43}$/.test(t);

export function urlDoApp(caminho: string): string {
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${caminho}`;
}
