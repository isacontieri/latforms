import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

/** Cliente do navegador (publishable key). Na página do cliente, só para `uploadToSignedUrl`. */
export function criarClienteNavegador() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
