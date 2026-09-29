import { registrarAuditoria } from '@/lib/audit';
import { exigirAdmin } from '@/lib/auth';
import { falha, ok } from '@/lib/http';
import { criarClienteAdmin } from '@/lib/supabase/admin';

/** Remove o acesso de uma consultora (apaga a conta; o histórico da auditoria continua). */
export async function DELETE(_req: Request, ctx: RouteContext<'/api/equipe/[id]'>) {
  const consultora = await exigirAdmin();
  if (consultora instanceof Response) return consultora;
  const { id } = await ctx.params;

  if (id === consultora.id) return falha('Você não pode remover o seu próprio acesso.', 400);

  const admin = criarClienteAdmin();
  const { data: alvo } = await admin.from('consultoras').select('id').eq('id', id).maybeSingle();
  if (!alvo) return falha('Consultora não encontrada', 404);

  const { error } = await admin.auth.admin.deleteUser(id); // consultoras: on delete cascade
  if (error) {
    console.error('equipe/remover', error.code ?? error.status);
    return falha('Não foi possível remover o acesso', 500);
  }
  await registrarAuditoria({ ator: `consultora:${consultora.id}`, acao: `consultora_removida:${id}` });
  return ok({ id });
}
