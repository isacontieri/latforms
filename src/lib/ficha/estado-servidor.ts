import 'server-only';
import type { criarClienteServidor } from '@/lib/supabase/server';
import { LIMITE_EDICOES, linhaParaEdicao, type EstadoFicha } from './estado';

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

const comoRegistro = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, string | null>) : {});

/** Lê o estado atual da ficha do banco (com a sessão da consultora: RLS). */
export async function carregarEstadoFicha(supabase: Supabase, fichaId: string): Promise<EstadoFicha | null> {
  const [{ data: f }, { data: eds }] = await Promise.all([
    supabase
      .from('fichas')
      .select('id, status, dados_atuais, dados_originais, dados_revisados, revisado_em, campo_em_foco, cliente_visto_em, concluida_em')
      .eq('id', fichaId)
      .maybeSingle(),
    supabase
      .from('ficha_edicoes')
      .select('id, campo, valor_anterior, valor_novo, origem, criado_em')
      .eq('ficha_id', fichaId)
      .order('criado_em', { ascending: false })
      .limit(LIMITE_EDICOES),
  ]);
  if (!f) return null;
  return {
    id: f.id,
    status: f.status,
    atuais: comoRegistro(f.dados_atuais),
    originais: comoRegistro(f.dados_originais),
    revisados: f.dados_revisados ? comoRegistro(f.dados_revisados) : null,
    revisadoEm: f.revisado_em,
    campoEmFoco: f.campo_em_foco,
    clienteVistoEm: f.cliente_visto_em,
    concluidaEm: f.concluida_em,
    edicoes: (eds ?? []).map(linhaParaEdicao),
  };
}
