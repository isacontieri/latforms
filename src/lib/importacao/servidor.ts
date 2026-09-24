import 'server-only';
import type { criarClienteServidor } from '@/lib/supabase/server';
import type { ClienteExistente } from './lote';

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

/** Busca os clientes que já existem (por rd_id) com o snapshot da ficha mais recente. */
export async function buscarExistentes(supabase: Supabase, rdIds: string[]): Promise<Map<string, ClienteExistente>> {
  const mapa = new Map<string, ClienteExistente>();
  if (rdIds.length === 0) return mapa;

  const { data, error } = await supabase
    .from('clientes')
    .select('id, rd_id, fichas(dados_snapshot, criado_em)')
    .in('rd_id', rdIds)
    .order('criado_em', { referencedTable: 'fichas', ascending: false })
    .limit(1, { referencedTable: 'fichas' });
  if (error) throw new Error(`buscar clientes existentes: ${error.code}`);

  for (const c of data ?? []) {
    mapa.set(c.rd_id, { id: c.id, ultimaFicha: c.fichas[0]?.dados_snapshot ?? null });
  }
  return mapa;
}
