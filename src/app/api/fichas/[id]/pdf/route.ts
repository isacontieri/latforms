import { registrarAuditoria } from '@/lib/audit';
import { exigirFuncionario } from '@/lib/auth';
import { gerarFicha, nomeArquivoFicha } from '@/lib/ficha/pdf/gerar';
import { carregarRecursos } from '@/lib/ficha/pdf/recursos';
import { DadosFichaSchema } from '@/lib/ficha/schema';
import { falha } from '@/lib/http';
import { criarClienteServidor } from '@/lib/supabase/server';

function respostaPdf(pdf: Uint8Array, nomeArquivo: string): Response {
  return new Response(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

/** PDF da ficha para a equipe, gerado na hora (nada é salvo). */
export async function GET(_req: Request, ctx: RouteContext<'/api/fichas/[id]/pdf'>) {
  const funcionario = await exigirFuncionario();
  if (funcionario instanceof Response) return funcionario;

  const { id } = await ctx.params;

  const supabase = await criarClienteServidor();
  const { data: ficha } = await supabase
    .from('fichas')
    .select('id, dados_snapshot, clientes(nome)')
    .eq('id', id)
    .maybeSingle();
  if (!ficha) return falha('Ficha não encontrada', 404);

  const ator = `funcionario:${funcionario.id}`;
  const nome = ficha.clientes?.nome ?? null;

  const dados = DadosFichaSchema.safeParse(ficha.dados_snapshot);
  if (!dados.success) return falha('Esta ficha foi criada no modelo antigo. Gere uma nova versão para baixar o PDF.', 422);

  try {
    const { pdf, avisos } = await gerarFicha(dados.data, await carregarRecursos());
    if (avisos.length) console.info('pdf gerado com avisos', { fichaId: ficha.id, quantidade: avisos.length });
    await registrarAuditoria({ ator, acao: 'pdf_gerado_baixado', fichaId: ficha.id });
    return respostaPdf(pdf, nomeArquivoFicha(nome));
  } catch (e) {
    console.error('fichas/pdf: falha ao gerar', { fichaId: ficha.id, erro: (e as Error).name });
    return falha('Não foi possível gerar o PDF', 500);
  }
}
