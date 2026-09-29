import { registrarAuditoria } from '@/lib/audit';
import { exigirAdmin } from '@/lib/auth';
import { criarConvite } from '@/lib/equipe/convites';
import { falha, ok } from '@/lib/http';
import { criarClienteAdmin } from '@/lib/supabase/admin';

/** Gera um link de uso único (24 h) para a consultora definir uma senha nova. Sem e-mail. */
export async function POST(_req: Request, ctx: RouteContext<'/api/equipe/[id]/nova-senha'>) {
  const consultora = await exigirAdmin();
  if (consultora instanceof Response) return consultora;
  const { id } = await ctx.params;

  const { data: alvo } = await criarClienteAdmin().from('consultoras').select('id, email').eq('id', id).maybeSingle();
  if (!alvo?.email) return falha('Consultora não encontrada', 404);

  try {
    const link = await criarConvite({ tipo: 'nova_senha', email: alvo.email, usuarioId: alvo.id, criadoPor: consultora.id });
    await registrarAuditoria({ ator: `consultora:${consultora.id}`, acao: `link_nova_senha_criado:${alvo.id}` });
    return ok({ url: link.url, expiraEm: link.expiraEm }, { status: 201 });
  } catch (e) {
    console.error('equipe/nova-senha', (e as Error).message);
    return falha('Não foi possível gerar o link', 500);
  }
}
