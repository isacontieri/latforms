import { z } from 'zod';
import { dentroDoLimiteEscrita, muitasTentativas, naoEncontrado, respostaCliente, validarTokenCliente } from '@/lib/ficha/acesso-cliente';
import { eChaveDaFicha, validarValor } from '@/lib/ficha/layout';
import { editavelPeloCliente } from '@/lib/ficha/status';
import { clienteVerificado } from '@/lib/ficha/verificacao';
import { broadcast } from '@/lib/realtime/broadcast';
import { criarClienteAdmin } from '@/lib/supabase/admin';

const CorpoSchema = z.object({ campo: z.string().max(60), valor: z.string().max(2000).nullable() });

/**
 * Autosave de UM campo. Só chaves do ficha-layout.json; valor validado (tipo, opções, tamanho).
 * Grava via RPC atualizar_campo (atômica + histórico) e, se mudou, avisa a consultora pelo Realtime.
 * Nunca registra o valor em log.
 */
export async function PATCH(req: Request, ctx: RouteContext<'/api/f/[token]/campos'>) {
  const { token } = await ctx.params;
  const acesso = await validarTokenCliente(token);
  if (!acesso) return naoEncontrado();
  if (!(await dentroDoLimiteEscrita(acesso.tokenId))) return muitasTentativas();
  if (!(await clienteVerificado(acesso.tokenId))) return respostaCliente({ ok: false, erro: 'Confirme sua data de nascimento para continuar.' }, 401);
  if (!editavelPeloCliente(acesso.ficha.status)) {
    return respostaCliente({ ok: false, erro: 'Esta ficha já foi enviada e não pode mais ser alterada.' }, 409);
  }

  let corpo: z.infer<typeof CorpoSchema>;
  try {
    corpo = CorpoSchema.parse(await req.json());
  } catch {
    return respostaCliente({ ok: false, erro: 'Requisição inválida' }, 400);
  }
  if (!eChaveDaFicha(corpo.campo)) return respostaCliente({ ok: false, erro: 'Campo desconhecido' }, 400);
  const validacao = validarValor(corpo.campo, corpo.valor);
  if (!validacao.ok) return respostaCliente({ ok: false, erro: validacao.erro, campo: corpo.campo }, 422);

  const { data, error } = await criarClienteAdmin().rpc('atualizar_campo', {
    p_ficha: acesso.ficha.id,
    p_campo: corpo.campo,
    p_valor: validacao.valor,
    p_origem: 'cliente',
  });
  if (error) {
    if (error.message?.includes('ficha_bloqueada')) {
      return respostaCliente({ ok: false, erro: 'Esta ficha já foi enviada e não pode mais ser alterada.' }, 409);
    }
    console.error('f/campos: falha ao gravar', { fichaId: acesso.ficha.id, campo: corpo.campo, code: error.code });
    return respostaCliente({ ok: false, erro: 'Não foi possível salvar agora.' }, 500);
  }

  const salvoEm = new Date().toISOString();
  if (data) {
    const primeiraEdicao = acesso.ficha.status !== 'em_preenchimento';
    await broadcast(acesso.ficha.id, 'campo_atualizado', data as object, { lista: { em: salvoEm } });
    if (primeiraEdicao) await broadcast(acesso.ficha.id, 'status', { status: 'em_preenchimento', em: salvoEm }, { lista: { status: 'em_preenchimento', em: salvoEm } });
  }
  return respostaCliente({ ok: true, data: { salvoEm, alterado: data !== null } });
}
