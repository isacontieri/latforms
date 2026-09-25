import { exigirFuncionario } from '@/lib/auth';
import { atualizarDadosDaFicha } from '@/lib/ficha/atualizar';
import { falha, lerCorpo, ok } from '@/lib/http';
import { LoteSchema, planejarLote, resumir } from '@/lib/importacao/lote';
import { buscarExistentes } from '@/lib/importacao/servidor';
import { extrairLinha } from '@/lib/rd/extrair';
import type { Json } from '@/lib/supabase/database.types';
import { criarClienteServidor } from '@/lib/supabase/server';

/**
 * Grava um lote de uma importação: upsert por rd_id (nunca duplica cliente) e atualiza a ficha dos clientes
 * que ainda não a devolveram. Ficha devolvida não é alterada: o RD novo fica só para comparação.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/importacoes/[id]/lote'>) {
  const funcionario = await exigirFuncionario();
  if (funcionario instanceof Response) return funcionario;

  const { id } = await ctx.params;
  const corpo = await lerCorpo(req, LoteSchema);
  if (corpo instanceof Response) return corpo;

  const supabase = await criarClienteServidor();
  const { data: importacao } = await supabase
    .from('importacoes')
    .select('id, criados, atualizados, erros')
    .eq('id', id)
    .maybeSingle();
  if (!importacao) return falha('Importação não encontrada', 404);

  try {
    const rdIds = corpo.linhas.map((l) => extrairLinha(l).rdId).filter((x): x is string => x !== null);
    const existentes = await buscarExistentes(supabase, [...new Set(rdIds)]);
    const { resultados, salvar, atualizarFichas } = planejarLote(corpo.linhas, corpo.inicio, existentes);

    if (salvar.length > 0) {
      const { error } = await supabase.from('clientes').upsert(
        salvar.map((c) => ({
          ...c,
          dados_rd: c.dados_rd as unknown as Json,
          dados_ficha: c.dados_ficha as unknown as Json,
          ultima_importacao_id: id,
        })),
        { onConflict: 'rd_id' },
      );
      if (error) throw new Error(`upsert clientes: ${error.code}`);
    }

    // fichas ainda não devolvidas acompanham o RD (uma por cliente; nunca duplica)
    const ator = `funcionario:${funcionario.id}`;
    for (const f of atualizarFichas) {
      const atualizou = await atualizarDadosDaFicha(supabase, f, ator);
      if (!atualizou) {
        const r = resultados.find((x) => x.status !== 'erro' && existentes.get(x.rdId ?? '')?.ficha?.id === f.fichaId);
        if (r) r.ficha = 'devolvida_rd_mudou'; // cliente devolveu durante a importação
      }
    }

    // só IDs e mensagens — nunca conteúdo das células
    const errosDoLote = resultados
      .filter((r) => r.status === 'erro')
      .map((r) => ({ indice: r.indice, rdId: r.rdId, erro: r.erro }));
    const resumo = resumir(resultados);
    const { error: erroContagem } = await supabase
      .from('importacoes')
      .update({
        criados: importacao.criados + resumo.novos,
        atualizados: importacao.atualizados + resumo.atualizados,
        erros: [...((importacao.erros as Json[]) ?? []), ...errosDoLote],
      })
      .eq('id', id);
    if (erroContagem) throw new Error(`atualizar importacao: ${erroContagem.code}`);

    return ok({ resultados });
  } catch (e) {
    console.error('importacao/lote', (e as Error).message);
    return falha('Não foi possível gravar este lote', 500);
  }
}
