import { registrarAuditoria } from '@/lib/audit';
import { exigirConsultora } from '@/lib/auth';
import { proximoStatus, reabreAoGerarLink } from '@/lib/ficha/status';
import { falha, ok } from '@/lib/http';
import { broadcast } from '@/lib/realtime/broadcast';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { criarClienteServidor } from '@/lib/supabase/server';
import { gerarToken, hashToken, urlDoApp } from '@/lib/tokens';

function validadeDias(): number {
  const n = Number(process.env.TOKEN_TTL_DIAS ?? 15);
  return Number.isFinite(n) && n > 0 ? n : 15;
}

/**
 * Gera o link do cliente (revoga o anterior). O token puro só aparece nesta resposta.
 * Se a ficha estava concluída ou aprovada, ela é reaberta para o cliente editar pelo link novo.
 */
export async function POST(_req: Request, ctx: RouteContext<'/api/fichas/[id]/link'>) {
  const consultora = await exigirConsultora();
  if (consultora instanceof Response) return consultora;
  const { id } = await ctx.params;

  const supabase = await criarClienteServidor();
  const { data: ficha } = await supabase.from('fichas').select('id, status').eq('id', id).maybeSingle();
  if (!ficha) return falha('Ficha não encontrada', 404);
  if (!proximoStatus(ficha.status, 'gerar_link')) return falha('Esta ficha não aceita um novo link (cancelada ou aprovada).', 409);

  const admin = criarClienteAdmin();
  const token = gerarToken();
  const expiraEm = new Date(Date.now() + validadeDias() * 86_400_000).toISOString();
  // gerar_link (SQL, só a secret key): revoga o link ativo, cria o novo e muda "gerada" → "enviada", numa transação
  const { error } = await admin.rpc('gerar_link', {
    p_ficha_id: id,
    p_token_hash: hashToken(token),
    p_expira_em: expiraEm,
  });
  if (error) {
    console.error('fichas/link: gerar', error.code);
    return falha('Não foi possível gerar o link', 500);
  }

  await registrarAuditoria({ ator: `consultora:${consultora.id}`, acao: 'link_cliente_gerado', fichaId: id });

  let reaberta = false;
  if (reabreAoGerarLink(ficha.status)) {
    const { data } = await admin
      .from('fichas')
      .update({ status: 'em_preenchimento', concluida_em: null })
      .eq('id', id)
      .eq('status', ficha.status) // se mudou nesse meio-tempo, não mexe
      .select('id');
    reaberta = !!data?.length;
    if (reaberta) {
      const em = new Date().toISOString();
      await registrarAuditoria({ ator: `consultora:${consultora.id}`, acao: 'ficha_reaberta_por_novo_link', fichaId: id });
      await broadcast(id, 'status', { status: 'em_preenchimento', em }, { lista: { status: 'em_preenchimento', em } });
    }
  }
  return ok({ url: urlDoApp(`/f/${token}`), expiraEm, reaberta }, { status: 201 });
}

/** Revoga o link ativo da ficha. */
export async function DELETE(_req: Request, ctx: RouteContext<'/api/fichas/[id]/link'>) {
  const consultora = await exigirConsultora();
  if (consultora instanceof Response) return consultora;
  const { id } = await ctx.params;

  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from('tokens_acesso')
    .update({ revogado_em: new Date().toISOString() })
    .eq('ficha_id', id)
    .is('revogado_em', null)
    .select('id');
  if (!data?.length) return falha('Não há link ativo para esta ficha', 404);

  await registrarAuditoria({ ator: `consultora:${consultora.id}`, acao: 'link_cliente_revogado', fichaId: id });
  return ok({ revogados: data.length });
}
