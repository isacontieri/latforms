import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Verificação extra no link: pede a data de nascimento antes de mostrar a ficha.
 * TODO(v3): decisão pendente com a responsável — desligada por padrão; ligar com EXIGIR_VERIFICACAO=true.
 */
export function verificacaoLigada(): boolean {
  return process.env.EXIGIR_VERIFICACAO === 'true';
}

const VALIDADE_MS = 12 * 3600_000;
const nomeCookie = (tokenId: string) => `lf_v_${tokenId.slice(0, 8)}`;

function segredo(): string {
  const s = process.env.CRON_SECRET;
  if (!s) throw new Error('CRON_SECRET ausente (usado para assinar o cookie de verificação)');
  return s;
}

function assinatura(tokenId: string, expira: number): string {
  return createHmac('sha256', segredo()).update(`${tokenId}|${expira}`).digest('base64url');
}

/** Cookie httpOnly assinado que prova que o cliente confirmou a data de nascimento neste navegador. */
export async function marcarVerificado(tokenId: string): Promise<void> {
  const expira = Date.now() + VALIDADE_MS;
  (await cookies()).set(nomeCookie(tokenId), `${expira}.${assinatura(tokenId, expira)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VALIDADE_MS / 1000,
  });
}

/** true se a verificação está desligada ou se o navegador já confirmou a data de nascimento. */
export async function clienteVerificado(tokenId: string): Promise<boolean> {
  if (!verificacaoLigada()) return true;
  const valor = (await cookies()).get(nomeCookie(tokenId))?.value;
  if (!valor) return false;
  const [expiraTxt, sig] = valor.split('.');
  const expira = Number(expiraTxt);
  if (!Number.isFinite(expira) || expira < Date.now() || !sig) return false;
  const esperada = Buffer.from(assinatura(tokenId, expira));
  const recebida = Buffer.from(sig);
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}
