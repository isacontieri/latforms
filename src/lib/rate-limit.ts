import 'server-only';
import { criarClienteAdmin } from '@/lib/supabase/admin';

/**
 * Consome uma tentativa na janela (função Postgres `consumir_rate_limit`, sem serviço externo).
 * Devolve false quando o limite estourou. Se o banco falhar, deixa passar (e registra) para não travar o uso.
 */
export async function consumirRateLimit(chave: string, limite: number, janelaSeg: number): Promise<boolean> {
  const { data, error } = await criarClienteAdmin().rpc('consumir_rate_limit', {
    p_chave: chave,
    p_limite: limite,
    p_janela_seg: janelaSeg,
  });
  if (error) {
    console.error('rate-limit: falha', error.code);
    return true;
  }
  return data === true;
}
