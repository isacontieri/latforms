import { registrarAuditoria } from '@/lib/audit';
import { exigirConsultora } from '@/lib/auth';
import { falha, ok } from '@/lib/http';
import { broadcast } from '@/lib/realtime/broadcast';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { criarClienteServidor } from '@/lib/supabase/server';

/**
 * Marca a ficha como revisada: guarda a foto dos dados atuais. Daqui em diante, só o que o cliente
 * mudar depois disso fica amarelo. O histórico campo a campo continua completo.
 */
export async function POST(_req: Request, ctx: RouteContext<'/api/fichas/[id]/revisado'>) {
  const consultora = await exigirConsultora();
  if (consultora instanceof Response) return consultora;
  const { id } = await ctx.params;

  // a consultora precisa enxergar a ficha pela RLS antes de usarmos a secret key
  const { data: ficha } = await (await criarClienteServidor()).from('fichas').select('id').eq('id', id).maybeSingle();
  if (!ficha) return falha('Ficha não encontrada', 404);

  const { data: em, error } = await criarClienteAdmin().rpc('marcar_revisado', { p_ficha: id, p_consultora: consultora.id });
  if (error) {
    console.error('fichas/revisado', error.code);
    return falha('Não foi possível marcar como revisado', 500);
  }
  if (!em) return falha('Esta ficha foi cancelada.', 409);

  await registrarAuditoria({ ator: `consultora:${consultora.id}`, acao: 'ficha_revisada', fichaId: id });
  await broadcast(id, 'revisado', { em }, { lista: { em } });
  return ok({ revisadoEm: em });
}
