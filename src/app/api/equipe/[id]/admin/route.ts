import { z } from 'zod';
import { registrarAuditoria } from '@/lib/audit';
import { exigirAdmin } from '@/lib/auth';
import { falha, lerCorpo, ok } from '@/lib/http';
import { criarClienteAdmin } from '@/lib/supabase/admin';

const Corpo = z.object({ admin: z.boolean() });

/** Torna alguém da equipe administrador ou tira (nunca deixa a equipe sem nenhum administrador). */
export async function PATCH(req: Request, ctx: RouteContext<'/api/equipe/[id]/admin'>) {
  const consultora = await exigirAdmin();
  if (consultora instanceof Response) return consultora;
  const { id } = await ctx.params;
  const corpo = await lerCorpo(req, Corpo);
  if (corpo instanceof Response) return corpo;

  const { error } = await criarClienteAdmin().rpc('definir_admin', { p_alvo: id, p_admin: corpo.admin });
  if (error) {
    if (error.message.includes('ultimo_admin')) return falha('A equipe precisa de pelo menos um administrador.', 409);
    if (error.message.includes('consultora_inexistente')) return falha('Pessoa não encontrada na equipe', 404);
    console.error('equipe/admin', error.code);
    return falha('Não foi possível alterar', 500);
  }
  await registrarAuditoria({ ator: `consultora:${consultora.id}`, acao: `${corpo.admin ? 'admin_concedido' : 'admin_retirado'}:${id}` });
  return ok({ id, admin: corpo.admin });
}
