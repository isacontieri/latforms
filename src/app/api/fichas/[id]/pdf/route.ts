import { registrarAuditoria } from '@/lib/audit';
import { exigirFuncionario } from '@/lib/auth';
import { nomeArquivoFicha, preencherFicha } from '@/lib/ficha/pdf/fill';
import { carregarTemplate } from '@/lib/ficha/pdf/template';
import { DadosFichaSchema } from '@/lib/ficha/schema';
import { falha } from '@/lib/http';
import { criarClienteAdmin } from '@/lib/supabase/admin';
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

/**
 * PDF de uma ficha para o funcionário.
 * `tipo=gerado` (padrão): gerado na hora a partir de `dados_snapshot` — nada é salvo.
 * `tipo=respondido`: o arquivo devolvido pelo cliente, do Storage.
 */
export async function GET(req: Request, ctx: RouteContext<'/api/fichas/[id]/pdf'>) {
  const funcionario = await exigirFuncionario();
  if (funcionario instanceof Response) return funcionario;

  const { id } = await ctx.params;
  const tipo = new URL(req.url).searchParams.get('tipo') ?? 'gerado';
  if (tipo !== 'gerado' && tipo !== 'respondido') return falha('tipo inválido', 400);

  const supabase = await criarClienteServidor();
  const { data: ficha } = await supabase
    .from('fichas')
    .select('id, dados_snapshot, pdf_respondido_path, clientes(nome)')
    .eq('id', id)
    .maybeSingle();
  if (!ficha) return falha('Ficha não encontrada', 404);

  const ator = `funcionario:${funcionario.id}`;
  const nome = ficha.clientes?.nome ?? null;

  if (tipo === 'respondido') {
    if (!ficha.pdf_respondido_path) return falha('O cliente ainda não devolveu esta ficha', 404);
    const { data, error } = await criarClienteAdmin().storage.from('fichas-respondidas').download(ficha.pdf_respondido_path);
    if (error || !data) return falha('Arquivo não encontrado no Storage', 404);
    await registrarAuditoria({ ator, acao: 'pdf_respondido_baixado', fichaId: ficha.id });
    return respostaPdf(new Uint8Array(await data.arrayBuffer()), nomeArquivoFicha(nome).replace('.pdf', '_respondida.pdf'));
  }

  const dados = DadosFichaSchema.safeParse(ficha.dados_snapshot);
  if (!dados.success) return falha('Dados da ficha em formato inválido', 422);

  try {
    const { pdf, avisos } = await preencherFicha(await carregarTemplate(), dados.data);
    if (avisos.length) console.info('pdf gerado com avisos', { fichaId: ficha.id, quantidade: avisos.length });
    await registrarAuditoria({ ator, acao: 'pdf_gerado_baixado', fichaId: ficha.id });
    return respostaPdf(pdf, nomeArquivoFicha(nome));
  } catch (e) {
    console.error('fichas/pdf: falha ao gerar', { fichaId: ficha.id, erro: (e as Error).name });
    return falha('Não foi possível gerar o PDF', 500);
  }
}
