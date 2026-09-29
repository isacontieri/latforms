import { transicaoDaConsultora } from '@/lib/ficha/transicao';

export async function POST(_req: Request, ctx: RouteContext<'/api/fichas/[id]/reabrir'>) {
  const { id } = await ctx.params;
  return transicaoDaConsultora(id, 'reabrir');
}
