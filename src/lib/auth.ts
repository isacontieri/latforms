import 'server-only';
import { cache } from 'react';
import { criarClienteServidor } from '@/lib/supabase/server';

export interface Consultora {
  id: string;
  email: string | null;
  nome: string;
  /** administrador da equipe: convida, gera link de nova senha, remove acesso e define administradores */
  admin: boolean;
}

export type ResultadoAuth = { ok: true; consultora: Consultora } | { ok: false; status: 401 | 403 };

/**
 * Sessão válida + registro em `consultoras`. Não confia no proxy.ts: toda página e rota de consultora chama isto.
 * `getUser()` consulta o servidor de Auth (pega sessão revogada), por isso é a checagem de autorização.
 */
export const verificarConsultora = cache(async (): Promise<ResultadoAuth> => {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  // RLS de consultoras só deixa ler quem já é consultora: sem linha = não é consultora
  const { data } = await supabase.from('consultoras').select('nome, admin').eq('id', user.id).maybeSingle();
  if (!data) return { ok: false, status: 403 };

  return { ok: true, consultora: { id: user.id, email: user.email ?? null, nome: data.nome, admin: data.admin } };
});

/** Para route handlers: devolve a consultora ou a resposta de erro pronta. */
export async function exigirConsultora(): Promise<Consultora | Response> {
  const r = await verificarConsultora();
  if (r.ok) return r.consultora;
  return Response.json(
    { ok: false, erro: r.status === 401 ? 'Não autenticado' : 'Acesso negado' },
    { status: r.status },
  );
}

/** Para as rotas de equipe: só administradores. Devolve a consultora ou a resposta de erro pronta. */
export async function exigirAdmin(): Promise<Consultora | Response> {
  const c = await exigirConsultora();
  if (c instanceof Response || c.admin) return c;
  return Response.json({ ok: false, erro: 'Só administradores da equipe podem fazer isso.' }, { status: 403 });
}
