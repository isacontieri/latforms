import 'server-only';
import { registrarAuditoria } from '@/lib/audit';
import { exigirConsultora } from '@/lib/auth';
import { falha, ok } from '@/lib/http';
import { broadcast } from '@/lib/realtime/broadcast';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { criarClienteServidor } from '@/lib/supabase/server';
import { proximoStatus, ROTULO_STATUS, type EventoFicha } from './status';

type AcaoConsultora = Extract<EventoFicha, 'aprovar' | 'reabrir' | 'cancelar'>;

const AUDITORIA: Record<AcaoConsultora, string> = {
  aprovar: 'ficha_aprovada',
  reabrir: 'ficha_reaberta',
  cancelar: 'ficha_cancelada',
};

/**
 * Muda o status da ficha por ação da consultora (aprovar, reabrir, cancelar), avisa o painel e o
 * cliente pelo Realtime e grava auditoria. A atualização só vale se o status não mudou no meio-tempo.
 */
export async function transicaoDaConsultora(fichaId: string, acao: AcaoConsultora): Promise<Response> {
  const consultora = await exigirConsultora();
  if (consultora instanceof Response) return consultora;

  const { data: ficha } = await (await criarClienteServidor()).from('fichas').select('id, status').eq('id', fichaId).maybeSingle();
  if (!ficha) return falha('Ficha não encontrada', 404);
  const novo = proximoStatus(ficha.status, acao);
  if (!novo) return falha(`Não é possível ${acao} uma ficha "${ROTULO_STATUS[ficha.status]}".`, 409);

  const admin = criarClienteAdmin();
  const extra = acao === 'reabrir' ? { concluida_em: null } : {};
  const { data } = await admin
    .from('fichas')
    .update({ status: novo, campo_em_foco: null, ...extra })
    .eq('id', fichaId)
    .eq('status', ficha.status)
    .select('id');
  if (!data?.length) return falha('A situação da ficha mudou. Recarregue a página.', 409);

  // Cancelada: o link do cliente deixa de valer (o token já daria 404, mas revogar deixa explícito)
  if (acao === 'cancelar') {
    await admin.from('tokens_acesso').update({ revogado_em: new Date().toISOString() }).eq('ficha_id', fichaId).is('revogado_em', null);
  }

  const em = new Date().toISOString();
  await registrarAuditoria({ ator: `consultora:${consultora.id}`, acao: AUDITORIA[acao], fichaId });
  await broadcast(fichaId, 'status', { status: novo, em }, { lista: { status: novo, em } });
  return ok({ status: novo });
}
