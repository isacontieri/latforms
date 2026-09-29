'use server';

import { redirect } from 'next/navigation';
import { registrarAuditoria } from '@/lib/audit';
import { validarTokenCliente } from '@/lib/ficha/acesso-cliente';
import { marcarVerificado, verificacaoLigada } from '@/lib/ficha/verificacao';
import { consumirRateLimit } from '@/lib/rate-limit';

export interface EstadoVerificacao {
  erro: string | null;
}

/** Confere a data de nascimento informada com a do cadastro (só com EXIGIR_VERIFICACAO=true). */
export async function verificarNascimento(token: string, _anterior: EstadoVerificacao, form: FormData): Promise<EstadoVerificacao> {
  if (!verificacaoLigada()) redirect(`/f/${token}`);
  const acesso = await validarTokenCliente(token);
  if (!acesso) return { erro: 'Link inválido ou expirado.' };
  if (!(await consumirRateLimit(`fv:${acesso.tokenId}`, 5, 600))) {
    return { erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' };
  }

  const digitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');
  const informado = digitos(form.get('nascimento'));
  const cadastrado = digitos((acesso.ficha.dadosOriginais as Record<string, unknown> | null)?.nascimento);

  // TODO(v3): sem data de nascimento no cadastro não há como verificar — hoje libera e registra na auditoria
  if (cadastrado && informado !== cadastrado) {
    await registrarAuditoria({ ator: `cliente:${acesso.ficha.id}`, acao: 'verificacao_falhou', fichaId: acesso.ficha.id });
    return { erro: 'A data não confere com o nosso cadastro. Confira e tente de novo.' };
  }
  await marcarVerificado(acesso.tokenId);
  await registrarAuditoria({ ator: `cliente:${acesso.ficha.id}`, acao: cadastrado ? 'verificacao_ok' : 'verificacao_sem_data_no_cadastro', fichaId: acesso.ficha.id });
  redirect(`/f/${token}`);
}
