// As variáveis NEXT_PUBLIC_ precisam ser lidas de forma literal para o Next embuti-las no bundle do navegador.

export const SUPABASE_URL = obrigatoria('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_PUBLISHABLE_KEY = obrigatoria(
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

function obrigatoria(nome: string, valor: string | undefined): string {
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}
