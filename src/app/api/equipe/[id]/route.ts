import { registrarAuditoria } from '@/lib/audit';
import { exigirFuncionario } from '@/lib/auth';
import { falha, ok } from '@/lib/http';
import { criarClienteAdmin } from '@/lib/supabase/admin';

/** Remove o acesso de um funcionário (apaga a conta; o histórico da auditoria continua). */
export async function DELETE(_req: Request, ctx: RouteContext<'/api/equipe/[id]'>) {
  const funcionario = await exigirFuncionario();
  if (funcionario instanceof Response) return funcionario;
  const { id } = await ctx.params;

  if (id === funcionario.id) return falha('Você não pode remover o seu próprio acesso.', 400);

  const admin = criarClienteAdmin();
  const { data: alvo } = await admin.from('funcionarios').select('id').eq('id', id).maybeSingle();
  if (!alvo) return falha('Funcionário não encontrado', 404);

  const { error } = await admin.auth.admin.deleteUser(id); // funcionarios: on delete cascade
  if (error) {
    console.error('equipe/remover', error.code ?? error.status);
    return falha('Não foi possível remover o acesso', 500);
  }
  await registrarAuditoria({ ator: `funcionario:${funcionario.id}`, acao: `funcionario_removido:${id}` });
  return ok({ id });
}
