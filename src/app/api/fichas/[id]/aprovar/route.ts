import { transicaoDaConsultora } from '@/lib/ficha/transicao';

export async function POST(_req: Request, ctx: RouteContext<'/api/fichas/[id]/aprovar'>) {
  const { id } = await ctx.params;
  return transicaoDaConsultora(id, 'aprovar');
}
