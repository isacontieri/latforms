import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './env';

/**
 * Cliente com a SECRET KEY: ignora RLS. Só em route handlers e server actions.
 * Usado nas rotas do cliente (/f/*, /api/f/*), no cron e na auditoria.
 */
export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error('Variável de ambiente ausente: SUPABASE_SECRET_KEY');
  return createClient(SUPABASE_URL, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
