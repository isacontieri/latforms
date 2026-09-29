import 'server-only';
import { registrarAuditoria } from '@/lib/audit';
import type { criarClienteServidor } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';
import type { DadosFicha } from './schema';
import type { StatusFicha } from './status';

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

/** Mesma regra de `aceitaDadosDoRd`: o cliente ainda não editou nenhum campo. */
const SEM_EDICAO_DO_CLIENTE: StatusFicha[] = ['gerada', 'enviada', 'aberta'];

/**
 * Leva os dados novos do RD para a ficha (originais e atuais), só se o cliente ainda não editou nada.
 * Se ele editou nesse meio-tempo, não altera (a condição de status está no próprio UPDATE).
 */
export async function atualizarFichaPeloRd(
  supabase: Supabase,
  ficha: { fichaId: string; dados: DadosFicha },
  ator: string,
): Promise<boolean> {
  const dados = ficha.dados as unknown as Json;
  const { data, error } = await supabase
    .from('fichas')
    .update({ dados_originais: dados, dados_atuais: dados, dados_revisados: null, revisado_em: null, revisado_por: null })
    .eq('id', ficha.fichaId)
    .in('status', SEM_EDICAO_DO_CLIENTE)
    .select('id');
  if (error) throw new Error(`atualizar ficha pelo RD: ${error.code}`);
  const atualizou = (data ?? []).length > 0;
  if (atualizou) await registrarAuditoria({ ator, acao: 'ficha_atualizada_pelo_rd', fichaId: ficha.fichaId });
  return atualizou;
}
