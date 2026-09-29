import { exigirConsultora } from '@/lib/auth';
import { carregarEstadoFicha } from '@/lib/ficha/estado-servidor';
import { falha, ok } from '@/lib/http';
import { criarClienteServidor } from '@/lib/supabase/server';

/** Estado atual da ficha para o painel ao vivo (o Realtime só avisa; o banco é a fonte da verdade). */
export async function GET(_req: Request, ctx: RouteContext<'/api/fichas/[id]/estado'>) {
  const consultora = await exigirConsultora();
  if (consultora instanceof Response) return consultora;
  const { id } = await ctx.params;
  const estado = await carregarEstadoFicha(await criarClienteServidor(), id);
  if (!estado) return falha('Ficha não encontrada', 404);
  return ok(estado, { headers: { 'Cache-Control': 'private, no-store' } });
}
