import 'server-only';
import { headers } from 'next/headers';
import { ipDaRequisicao } from '@/lib/audit';
import { consumirRateLimit } from '@/lib/rate-limit';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { hashToken, tokenValido } from '@/lib/tokens';
import type { StatusFicha } from './status';

/** Limites das rotas do cliente (plano v3 §9): 30 req/min por IP e 60 escritas/min por token. */
export const LIMITE_IP = { limite: 30, janelaSeg: 60 };
export const LIMITE_ESCRITA_TOKEN = { limite: 60, janelaSeg: 60 };

export interface AcessoCliente {
  tokenId: string;
  expiraEm: string;
  ficha: {
    id: string;
    status: StatusFicha;
    dadosAtuais: unknown;
    dadosOriginais: unknown;
    concluidaEm: string | null;
  };
  cliente: { nome: string; email: string | null };
}

/** Rate limit por IP para /f/* e /api/f/*. */
export async function dentroDoLimiteIp(): Promise<boolean> {
  const ip = ipDaRequisicao(await headers()) ?? 'desconhecido';
  return consumirRateLimit(`f:${ip}`, LIMITE_IP.limite, LIMITE_IP.janelaSeg);
}

/** Rate limit de escrita por token (autosave). */
export function dentroDoLimiteEscrita(tokenId: string): Promise<boolean> {
  return consumirRateLimit(`fw:${tokenId}`, LIMITE_ESCRITA_TOKEN.limite, LIMITE_ESCRITA_TOKEN.janelaSeg);
}

/**
 * Token do link do cliente → ficha. `null` para inexistente, revogado, expirado ou ficha cancelada
 * (quem chama responde sempre 404 genérico). Com `registrarUso`, conta o acesso (sem mudar o status).
 */
export async function validarTokenCliente(token: string, opcoes: { registrarUso?: boolean } = {}): Promise<AcessoCliente | null> {
  if (!tokenValido(token)) return null;
  const admin = criarClienteAdmin();
  const { data } = await admin
    .from('tokens_acesso')
    .select('id, expira_em, revogado_em, usos, fichas(id, status, dados_atuais, dados_originais, concluida_em, clientes(nome, email))')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  const ficha = data?.fichas;
  if (!data || !ficha || data.revogado_em || new Date(data.expira_em) <= new Date() || ficha.status === 'cancelada') return null;

  if (opcoes.registrarUso) {
    await admin.from('tokens_acesso').update({ usos: data.usos + 1, ultimo_acesso_em: new Date().toISOString() }).eq('id', data.id);
  }

  return {
    tokenId: data.id,
    expiraEm: data.expira_em,
    ficha: {
      id: ficha.id,
      status: ficha.status,
      dadosAtuais: ficha.dados_atuais,
      dadosOriginais: ficha.dados_originais,
      concluidaEm: ficha.concluida_em,
    },
    cliente: { nome: ficha.clientes?.nome ?? '', email: ficha.clientes?.email ?? null },
  };
}

/** Respostas das rotas /api/f/*: nunca em cache. */
export const SEM_CACHE = { 'Cache-Control': 'no-store' };

export function respostaCliente(corpo: object, status = 200): Response {
  return Response.json(corpo, { status, headers: SEM_CACHE });
}

export function naoEncontrado(): Response {
  return respostaCliente({ ok: false, erro: 'Link inválido ou expirado' }, 404);
}

export function muitasTentativas(): Response {
  return respostaCliente({ ok: false, erro: 'Muitas tentativas em pouco tempo. Aguarde um minuto.' }, 429);
}
