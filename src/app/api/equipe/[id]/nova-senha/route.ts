import { registrarAuditoria } from '@/lib/audit';
import { exigirFuncionario } from '@/lib/auth';
import { criarConvite } from '@/lib/equipe/convites';
import { falha, ok } from '@/lib/http';
import { criarClienteAdmin } from '@/lib/supabase/admin';

/** Gera um link de uso único (24 h) para o funcionário definir uma senha nova. Sem e-mail. */
export async function POST(_req: Request, ctx: RouteContext<'/api/equipe/[id]/nova-senha'>) {
  const funcionario = await exigirFuncionario();
  if (funcionario instanceof Response) return funcionario;
  const { id } = await ctx.params;

  const { data: alvo } = await criarClienteAdmin().from('funcionarios').select('id, email').eq('id', id).maybeSingle();
  if (!alvo?.email) return falha('Funcionário não encontrado', 404);

  try {
    const link = await criarConvite({ tipo: 'nova_senha', email: alvo.email, usuarioId: alvo.id, criadoPor: funcionario.id });
    await registrarAuditoria({ ator: `funcionario:${funcionario.id}`, acao: `link_nova_senha_criado:${alvo.id}` });
    return ok({ url: link.url, expiraEm: link.expiraEm }, { status: 201 });
  } catch (e) {
    console.error('equipe/nova-senha', (e as Error).message);
    return falha('Não foi possível gerar o link', 500);
  }
}
