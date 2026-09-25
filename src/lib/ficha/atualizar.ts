import 'server-only';
import { registrarAuditoria } from '@/lib/audit';
import type { criarClienteServidor } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';
import type { DadosFicha } from './schema';
import type { StatusFicha } from './status';

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

/** Status em que a ficha ainda acompanha o RD (mesma regra de `aceitaDadosDoRd`). */
const NAO_DEVOLVIDA: StatusFicha[] = ['gerada', 'enviada', 'aberta'];

/**
 * Troca os dados pré-preenchidos de uma ficha ainda não devolvida. O link do cliente continua o mesmo
 * e passa a baixar o PDF atualizado. Se o cliente devolveu nesse meio-tempo, não altera nada.
 */
export async function atualizarDadosDaFicha(
  supabase: Supabase,
  ficha: { fichaId: string; versao: number; snapshot: DadosFicha },
  ator: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('fichas')
    .update({
      dados_snapshot: ficha.snapshot as unknown as Json,
      versao: ficha.versao + 1,
      snapshot_atualizado_em: new Date().toISOString(),
    })
    .eq('id', ficha.fichaId)
    .in('status', NAO_DEVOLVIDA)
    .select('id');
  if (error) throw new Error(`atualizar ficha: ${error.code}`);
  const atualizou = (data ?? []).length > 0;
  if (atualizou) await registrarAuditoria({ ator, acao: 'ficha_atualizada_pelo_rd', fichaId: ficha.fichaId });
  return atualizou;
}
