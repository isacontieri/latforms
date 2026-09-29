import { createHash, timingSafeEqual } from 'node:crypto';
import { registrarAuditoria } from '@/lib/audit';
import { falha, ok } from '@/lib/http';
import { criarClienteAdmin } from '@/lib/supabase/admin';

const DIA = 86_400_000;
const antesDe = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();
const hash = (s: string) => createHash('sha256').update(s).digest();

function autorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  const recebido = req.headers.get('authorization') ?? '';
  return !!segredo && timingSafeEqual(hash(recebido), hash(`Bearer ${segredo}`));
}

/**
 * Manutenção diária (a Vercel Hobby roda cron 1x/dia), idempotente:
 * consulta o banco (evita a pausa do Supabase Free) → limpa rate_limit > 1 dia → tokens expirados ou
 * revogados > 30 dias → histórico de fichas aprovadas > 180 dias → auditoria.
 */
export async function GET(req: Request) {
  if (!autorizado(req)) return falha('Não encontrado', 404);
  const admin = criarClienteAdmin();

  const { error: eVivo } = await admin.from('consultoras').select('id', { head: true, count: 'exact' });
  if (eVivo) {
    console.error('cron: keep-alive', eVivo.code);
    return falha('Falha na manutenção', 500);
  }

  const erros: string[] = [];
  const contar = async (etapa: string, q: PromiseLike<{ count: number | null; error: { code: string } | null }>) => {
    const { count, error } = await q;
    if (error) erros.push(`${etapa}:${error.code}`);
    return count ?? 0;
  };

  const rateLimit = await contar('rate_limit', admin.from('rate_limit').delete({ count: 'exact' }).lt('janela_inicio', antesDe(1)));
  const tokensExpirados = await contar('tokens', admin.from('tokens_acesso').delete({ count: 'exact' }).lt('expira_em', antesDe(30)));
  const tokensRevogados = await contar('tokens_revogados', admin.from('tokens_acesso').delete({ count: 'exact' }).lt('revogado_em', antesDe(30)));

  let historico = 0;
  const { data: antigas, error: eAntigas } = await admin
    .from('fichas')
    .select('id')
    .eq('status', 'aprovada')
    .lt('atualizado_em', antesDe(180))
    .limit(1000);
  if (eAntigas) erros.push(`fichas_antigas:${eAntigas.code}`);
  else if (antigas.length) {
    historico = await contar('historico', admin.from('ficha_edicoes').delete({ count: 'exact' }).in('ficha_id', antigas.map((f) => f.id)));
  }

  const resumo = { rateLimit, tokens: tokensExpirados + tokensRevogados, historico };
  await registrarAuditoria({ ator: 'cron', acao: `manutencao:rl=${rateLimit}:tk=${resumo.tokens}:hist=${historico}${erros.length ? ':com_erros' : ''}` });
  if (erros.length) {
    console.error('cron: etapas com erro', erros);
    return falha('Manutenção com erros', 500);
  }
  return ok(resumo);
}
