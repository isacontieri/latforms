import 'server-only';
import { headers } from 'next/headers';
import { ipDaRequisicao } from '@/lib/audit';
import { consumirRateLimit } from '@/lib/rate-limit';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { hashToken, tokenValido } from '@/lib/tokens';
import type { StatusFicha } from './status';

/** Limite das rotas do cliente: 20 requisições por minuto por IP (skill §9). */
export const LIMITE_CLIENTE = { limite: 20, janelaSeg: 60 };

export interface AcessoCliente {
  tokenId: string;
  expiraEm: string;
  ficha: {
    id: string;
    status: StatusFicha;
    dadosSnapshot: unknown;
    pdfRespondidoPath: string | null;
    respondidaEm: string | null;
    motivoCorrecao: string | null;
  };
  cliente: { nome: string; email: string | null };
}

/** Rate limit por IP para /f/* e /api/f/*. */
export async function dentroDoLimiteCliente(): Promise<boolean> {
  const ip = ipDaRequisicao(await headers()) ?? 'desconhecido';
  return consumirRateLimit(`f:${ip}`, LIMITE_CLIENTE.limite, LIMITE_CLIENTE.janelaSeg);
}

/**
 * Token do link do cliente → ficha. `null` para inexistente, revogado, expirado ou ficha cancelada
 * (quem chama responde sempre 404 genérico). Registra o uso (contador e último acesso), sem mudar o status.
 */
export async function validarTokenCliente(token: string): Promise<AcessoCliente | null> {
  if (!tokenValido(token)) return null;
  const admin = criarClienteAdmin();
  const { data } = await admin
    .from('tokens_acesso')
    .select(
      'id, expira_em, revogado_em, usos, fichas(id, status, dados_snapshot, pdf_respondido_path, respondida_em, motivo_correcao, clientes(nome, email))',
    )
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  const ficha = data?.fichas;
  if (!data || !ficha || data.revogado_em || new Date(data.expira_em) <= new Date() || ficha.status === 'cancelada') return null;

  await admin.from('tokens_acesso').update({ usos: data.usos + 1, ultimo_acesso_em: new Date().toISOString() }).eq('id', data.id);

  return {
    tokenId: data.id,
    expiraEm: data.expira_em,
    ficha: {
      id: ficha.id,
      status: ficha.status,
      dadosSnapshot: ficha.dados_snapshot,
      pdfRespondidoPath: ficha.pdf_respondido_path,
      respondidaEm: ficha.respondida_em,
      motivoCorrecao: ficha.motivo_correcao,
    },
    cliente: { nome: ficha.clientes?.nome ?? '', email: ficha.clientes?.email ?? null },
  };
}

/** Respostas das rotas /api/f/*: nunca em cache. */
export const SEM_CACHE = { 'Cache-Control': 'no-store' };

export function naoEncontrado(): Response {
  return Response.json({ ok: false, erro: 'Link inválido ou expirado' }, { status: 404, headers: SEM_CACHE });
}
