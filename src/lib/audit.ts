import 'server-only';
import { headers } from 'next/headers';
import { criarClienteAdmin } from '@/lib/supabase/admin';

export interface EventoAuditoria {
  /** 'funcionario:<uuid>', 'cliente:<ficha_id>' ou 'cron' */
  ator: string;
  acao: string;
  fichaId?: string | null;
}

/** IP do cliente na Vercel (`x-real-ip`); localmente, o primeiro de `x-forwarded-for`. */
export function ipDaRequisicao(h: Headers): string | null {
  const ip = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return ip || null;
}

/** Grava na tabela `auditoria`. Nunca recebe conteúdo do CSV/PDF — só IDs e o nome da ação. */
export async function registrarAuditoria({ ator, acao, fichaId = null }: EventoAuditoria): Promise<void> {
  const h = await headers();
  const { error } = await criarClienteAdmin().from('auditoria').insert({
    ator,
    acao,
    ficha_id: fichaId,
    ip: ipDaRequisicao(h),
    user_agent: h.get('user-agent')?.slice(0, 300) ?? null,
  });
  if (error) console.error('auditoria: falha ao gravar', { acao, code: error.code });
}
