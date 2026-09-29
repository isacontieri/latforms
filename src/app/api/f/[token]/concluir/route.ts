import { registrarAuditoria } from '@/lib/audit';
import { dentroDoLimiteIp, muitasTentativas, naoEncontrado, respostaCliente, validarTokenCliente } from '@/lib/ficha/acesso-cliente';
import { CAMPO_LAYOUT, obrigatoriosFaltando } from '@/lib/ficha/layout';
import { proximoStatus } from '@/lib/ficha/status';
import { clienteVerificado } from '@/lib/ficha/verificacao';
import { broadcast } from '@/lib/realtime/broadcast';
import { criarClienteAdmin } from '@/lib/supabase/admin';

/** O cliente conclui a ficha: confere os obrigatórios no banco, muda para "concluida" e avisa a consultora. */
export async function POST(_req: Request, ctx: RouteContext<'/api/f/[token]/concluir'>) {
  if (!(await dentroDoLimiteIp())) return muitasTentativas();
  const { token } = await ctx.params;
  const acesso = await validarTokenCliente(token);
  if (!acesso) return naoEncontrado();
  if (!(await clienteVerificado(acesso.tokenId))) return respostaCliente({ ok: false, erro: 'Confirme sua data de nascimento para continuar.' }, 401);

  const novo = proximoStatus(acesso.ficha.status, 'concluir');
  if (!novo) return respostaCliente({ ok: false, erro: 'Esta ficha já foi enviada.' }, 409);

  const faltando = obrigatoriosFaltando((acesso.ficha.dadosAtuais ?? {}) as Record<string, string | null>);
  if (faltando.length) {
    return respostaCliente(
      { ok: false, erro: 'Faltam alguns dados obrigatórios.', faltando: faltando.map((k) => ({ campo: k, rotulo: CAMPO_LAYOUT.get(k)?.rotulo ?? k })) },
      422,
    );
  }

  const em = new Date().toISOString();
  const { data } = await criarClienteAdmin()
    .from('fichas')
    .update({ status: novo, concluida_em: em, campo_em_foco: null })
    .eq('id', acesso.ficha.id)
    .eq('status', acesso.ficha.status) // se mudou nesse meio-tempo, não sobrescreve
    .select('id');
  if (!data?.length) return respostaCliente({ ok: false, erro: 'A situação da ficha mudou. Recarregue a página.' }, 409);

  await registrarAuditoria({ ator: `cliente:${acesso.ficha.id}`, acao: 'cliente_concluiu_ficha', fichaId: acesso.ficha.id });
  await broadcast(acesso.ficha.id, 'status', { status: novo, em }, { lista: { status: novo, em } });
  return respostaCliente({ ok: true, data: { status: novo, concluidaEm: em } });
}
