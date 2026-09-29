import { z } from 'zod';
import { registrarAuditoria } from '@/lib/audit';
import { dentroDoLimitePresenca, muitasTentativas, naoEncontrado, respostaCliente, validarTokenCliente } from '@/lib/ficha/acesso-cliente';
import { eChaveDaFicha } from '@/lib/ficha/layout';
import { proximoStatus } from '@/lib/ficha/status';
import { clienteVerificado } from '@/lib/ficha/verificacao';
import { broadcast } from '@/lib/realtime/broadcast';
import { criarClienteAdmin } from '@/lib/supabase/admin';

const CorpoSchema = z.object({ campo: z.string().max(60).nullable() });

/**
 * Presença do cliente: em que campo ele está (ou null) + "visto agora" (heartbeat de 30 s).
 * O 1º sinal marca a ficha como "aberta": só um navegador de verdade roda o JavaScript que chama esta rota
 * (pré-visualizações de link do WhatsApp/e-mail não), então é mais fiel que contar o GET da página.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/f/[token]/presenca'>) {
  const { token } = await ctx.params;
  const acesso = await validarTokenCliente(token);
  if (!acesso) return naoEncontrado();
  if (!(await dentroDoLimitePresenca(acesso.tokenId))) return muitasTentativas();
  if (!(await clienteVerificado(acesso.tokenId))) return respostaCliente({ ok: false, erro: 'Verificação pendente' }, 401);

  let campo: string | null;
  try {
    campo = CorpoSchema.parse(await req.json()).campo;
  } catch {
    return respostaCliente({ ok: false, erro: 'Requisição inválida' }, 400);
  }
  if (campo !== null && !eChaveDaFicha(campo)) return respostaCliente({ ok: false, erro: 'Campo desconhecido' }, 400);

  const em = new Date().toISOString();
  const novoStatus = proximoStatus(acesso.ficha.status, 'primeiro_acesso');
  const abriuAgora = novoStatus === 'aberta' && acesso.ficha.status === 'enviada';

  const admin = criarClienteAdmin();
  const { error } = await admin
    .from('fichas')
    .update({ campo_em_foco: campo, cliente_visto_em: em, ...(abriuAgora ? { status: 'aberta' as const } : {}) })
    .eq('id', acesso.ficha.id);
  if (error) {
    console.error('f/presenca: falha', { fichaId: acesso.ficha.id, code: error.code });
    return respostaCliente({ ok: false, erro: 'Falha' }, 500);
  }

  if (abriuAgora) {
    await registrarAuditoria({ ator: `cliente:${acesso.ficha.id}`, acao: 'cliente_abriu_ficha', fichaId: acesso.ficha.id });
    await broadcast(acesso.ficha.id, 'status', { status: 'aberta', em }, { lista: { status: 'aberta', em } });
  }
  await broadcast(acesso.ficha.id, 'presenca', { campo, em }, { lista: { em } });
  return respostaCliente({ ok: true, data: { em } });
}
