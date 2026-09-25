import { z } from 'zod';
import { registrarAuditoria } from '@/lib/audit';
import { exigirFuncionario } from '@/lib/auth';
import { atualizarDadosDaFicha } from '@/lib/ficha/atualizar';
import { mapearParaFicha } from '@/lib/ficha/mapping';
import { aceitaDadosDoRd } from '@/lib/ficha/status';
import { falha, lerCorpo, ok } from '@/lib/http';
import { jsonIgual } from '@/lib/importacao/lote';
import type { Json } from '@/lib/supabase/database.types';
import type { DadosRd } from '@/lib/rd/extrair';
import { criarClienteServidor } from '@/lib/supabase/server';

const GerarFichaSchema = z.object({ clienteId: z.uuid() });

/**
 * Gera ou atualiza a ficha do cliente — sempre UMA por cliente, nunca duplica.
 * - sem ficha: cria (status "gerada");
 * - ficha não devolvida: atualiza os dados pré-preenchidos com o RD atual (o link continua o mesmo);
 * - ficha devolvida: não altera (409); o RD atual aparece na página só para comparação.
 */
export async function POST(req: Request) {
  const funcionario = await exigirFuncionario();
  if (funcionario instanceof Response) return funcionario;

  const corpo = await lerCorpo(req, GerarFichaSchema);
  if (corpo instanceof Response) return corpo;

  const supabase = await criarClienteServidor();
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, dados_rd, fichas(id, status, versao, dados_snapshot)')
    .eq('id', corpo.clienteId)
    .neq('fichas.status', 'cancelada')
    .maybeSingle();
  if (!cliente) return falha('Cliente não encontrado', 404);

  const campos = (cliente.dados_rd as unknown as DadosRd | null)?.campos;
  if (!campos) return falha('Os dados do RD deste cliente estão incompletos; reimporte o CSV', 422);
  const snapshot = mapearParaFicha(campos);
  const ator = `funcionario:${funcionario.id}`;
  const ativa = cliente.fichas[0];

  if (ativa) {
    if (!aceitaDadosDoRd(ativa.status)) {
      return falha('O cliente já devolveu esta ficha. Os dados dele foram mantidos; o RD atual aparece abaixo para comparação.', 409);
    }
    if (jsonIgual(ativa.dados_snapshot, snapshot)) return ok({ id: ativa.id, versao: ativa.versao, status: ativa.status, acao: 'sem_mudanca' });
    const atualizou = await atualizarDadosDaFicha(supabase, { fichaId: ativa.id, versao: ativa.versao, snapshot }, ator);
    if (!atualizou) return falha('O cliente devolveu a ficha agora há pouco; os dados dele foram mantidos.', 409);
    return ok({ id: ativa.id, versao: ativa.versao + 1, status: ativa.status, acao: 'atualizada' });
  }

  const { data: ficha, error } = await supabase
    .from('fichas')
    .insert({ cliente_id: cliente.id, versao: 1, dados_snapshot: snapshot as unknown as Json, criado_por: funcionario.id })
    .select('id, versao, status')
    .single();
  if (error) {
    // 23505 = outra requisição criou a ficha ao mesmo tempo (índice de uma ficha ativa por cliente)
    if (error.code === '23505') return falha('A ficha deste cliente acabou de ser criada. Recarregue a página.', 409);
    console.error('fichas: criar', error.code);
    return falha('Não foi possível criar a ficha', 500);
  }

  await registrarAuditoria({ ator, acao: 'ficha_criada', fichaId: ficha.id });
  return ok({ ...ficha, acao: 'criada' }, { status: 201 });
}
