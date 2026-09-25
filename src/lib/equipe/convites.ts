import 'server-only';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import { gerarToken, hashToken, tokenValido, urlDoApp } from '@/lib/tokens';

export type TipoConvite = Database['public']['Enums']['tipo_convite'];

/** Validade: convite de pessoa nova 7 dias; link de nova senha 24 horas. */
export const VALIDADE_HORAS: Record<TipoConvite, number> = { convite: 24 * 7, nova_senha: 24 };

export interface ConviteValido {
  id: string;
  tipo: TipoConvite;
  email: string;
  nome: string | null;
  usuarioId: string | null;
}

/** Cria o link (revogando um pendente do mesmo e-mail/tipo). O token puro só existe nesta resposta. */
export async function criarConvite(p: {
  tipo: TipoConvite;
  email: string;
  nome?: string | null;
  usuarioId?: string | null;
  criadoPor: string;
}): Promise<{ id: string; url: string; expiraEm: string }> {
  const admin = criarClienteAdmin();
  const email = p.email.trim().toLowerCase();

  await admin
    .from('convites_equipe')
    .update({ revogado_em: new Date().toISOString() })
    .ilike('email', email)
    .eq('tipo', p.tipo)
    .is('usado_em', null)
    .is('revogado_em', null);

  const token = gerarToken();
  const expiraEm = new Date(Date.now() + VALIDADE_HORAS[p.tipo] * 3600_000).toISOString();
  const { data, error } = await admin
    .from('convites_equipe')
    .insert({
      tipo: p.tipo,
      token_hash: hashToken(token),
      email,
      nome: p.nome?.trim() || null,
      usuario_id: p.usuarioId ?? null,
      criado_por: p.criadoPor,
      expira_em: expiraEm,
    })
    .select('id')
    .single();
  if (error) throw new Error(`criar convite: ${error.code}`);
  return { id: data.id, url: urlDoApp(`/convite/${token}`), expiraEm };
}

/** Convite pendente e dentro da validade, ou null (inexistente, usado, revogado ou expirado). */
export async function buscarConviteValido(token: string): Promise<ConviteValido | null> {
  if (!tokenValido(token)) return null;
  const { data } = await criarClienteAdmin()
    .from('convites_equipe')
    .select('id, tipo, email, nome, usuario_id, expira_em, usado_em, revogado_em')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (!data || data.usado_em || data.revogado_em || new Date(data.expira_em) <= new Date()) return null;
  return { id: data.id, tipo: data.tipo, email: data.email, nome: data.nome, usuarioId: data.usuario_id };
}

/** Marca como usado só se ainda estiver pendente (evita uso duplo simultâneo). */
export async function marcarUsado(id: string): Promise<boolean> {
  const { data } = await criarClienteAdmin()
    .from('convites_equipe')
    .update({ usado_em: new Date().toISOString() })
    .eq('id', id)
    .is('usado_em', null)
    .is('revogado_em', null)
    .select('id');
  return (data ?? []).length > 0;
}
