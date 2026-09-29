import { transicaoDaConsultora } from '@/lib/ficha/transicao';

export async function POST(_req: Request, ctx: RouteContext<'/api/fichas/[id]/cancelar'>) {
  const { id } = await ctx.params;
  return transicaoDaConsultora(id, 'cancelar');
}
