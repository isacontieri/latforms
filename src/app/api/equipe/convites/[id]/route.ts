import { registrarAuditoria } from '@/lib/audit';
import { exigirAdmin } from '@/lib/auth';
import { falha, ok } from '@/lib/http';
import { criarClienteAdmin } from '@/lib/supabase/admin';

/** Revoga um link de convite ou de nova senha ainda não usado. */
export async function DELETE(_req: Request, ctx: RouteContext<'/api/equipe/convites/[id]'>) {
  const consultora = await exigirAdmin();
  if (consultora instanceof Response) return consultora;
  const { id } = await ctx.params;

  const { data } = await criarClienteAdmin()
    .from('convites_equipe')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', id)
    .is('usado_em', null)
    .is('revogado_em', null)
    .select('id');
  if (!data?.length) return falha('Convite não encontrado ou já usado', 404);

  await registrarAuditoria({ ator: `consultora:${consultora.id}`, acao: `convite_equipe_revogado:${id}` });
  return ok({ id });
}
