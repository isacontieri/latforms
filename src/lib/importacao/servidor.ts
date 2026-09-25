import 'server-only';
import type { criarClienteServidor } from '@/lib/supabase/server';
import type { ClienteExistente } from './lote';

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

/** Busca os clientes que já existem (por rd_id) com a ficha ativa (não cancelada) de cada um. */
export async function buscarExistentes(supabase: Supabase, rdIds: string[]): Promise<Map<string, ClienteExistente>> {
  const mapa = new Map<string, ClienteExistente>();
  if (rdIds.length === 0) return mapa;

  const { data, error } = await supabase
    .from('clientes')
    .select('id, rd_id, fichas(id, status, versao, dados_snapshot)')
    .in('rd_id', rdIds)
    .neq('fichas.status', 'cancelada');
  if (error) throw new Error(`buscar clientes existentes: ${error.code}`);

  for (const c of data ?? []) {
    const f = c.fichas[0]; // índice único: no máximo uma ficha ativa por cliente
    mapa.set(c.rd_id, {
      id: c.id,
      ficha: f ? { id: f.id, status: f.status, versao: f.versao, snapshot: f.dados_snapshot } : null,
    });
  }
  return mapa;
}
