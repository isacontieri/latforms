import 'server-only';
import { headers } from 'next/headers';
import { criarClienteAdmin } from '@/lib/supabase/admin';

export interface EventoAuditoria {
  /** 'consultora:<uuid>', 'cliente:<ficha_id>' ou 'cron' */
  ator: string;
  acao: string;
  fichaId?: string | null;
}

/** IP do cliente: `x-real-ip` (Vercel) ou o primeiro de `x-forwarded-for` (Azure/local), sem porta. */
export function ipDaRequisicao(h: Headers): string | null {
  const bruto = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!bruto) return null;

  let ip = bruto;
  const ipv6ComPorta = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (ipv6ComPorta) ip = ipv6ComPorta[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.split(':')[0];

  const pareceIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || /^[0-9a-fA-F:.]+$/.test(ip);
  return pareceIp ? ip : null;
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
  if (error) console.error('auditoria: falha ao gravar',
