import 'server-only';
import { SUPABASE_URL } from '@/lib/supabase/env';

export type EventoFicha = 'campo_atualizado' | 'presenca' | 'status';

/**
 * Publica no canal PRIVADO `ficha:<id>` (e, se pedido, em `fichas:lista`) pela API REST do Realtime.
 * Chamado pelo servidor depois de gravar no banco. Falha aqui NÃO falha a requisição: o dado já está
 * no banco e o painel recarrega do banco ao reconectar. Só registra aviso (sem conteúdo).
 */
export async function broadcast(fichaId: string, evento: EventoFicha, payload: object, opcoes: { lista?: boolean } = {}): Promise<void> {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) return;
  const messages = [{ topic: `ficha:${fichaId}`, event: evento, payload, private: true }];
  if (opcoes.lista) messages.push({ topic: 'fichas:lista', event: evento, payload: { fichaId, ...payload }, private: true });
  try {
    const r = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) console.warn('realtime: broadcast recusado', { fichaId, evento, status: r.status });
  } catch (e) {
    console.warn('realtime: broadcast falhou', { fichaId, evento, erro: (e as Error).name });
  }
}
