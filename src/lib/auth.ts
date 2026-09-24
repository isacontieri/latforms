import 'server-only';
import { cache } from 'react';
import { criarClienteServidor } from '@/lib/supabase/server';

export interface Funcionario {
  id: string;
  email: string | null;
  nome: string;
}

export type ResultadoAuth = { ok: true; funcionario: Funcionario } | { ok: false; status: 401 | 403 };

/**
 * Sessão válida + registro em `funcionarios`. Não confia no proxy.ts: toda página e rota de funcionário chama isto.
 * `getUser()` consulta o servidor de Auth (pega sessão revogada), por isso é a checagem de autorização.
 */
export const verificarFuncionario = cache(async (): Promise<ResultadoAuth> => {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  // RLS de funcionarios só deixa ler quem já é funcionário: sem linha = não é funcionário
  const { data } = await supabase.from('funcionarios').select('nome').eq('id', user.id).maybeSingle();
  if (!data) return { ok: false, status: 403 };

  return { ok: true, funcionario: { id: user.id, email: user.email ?? null, nome: data.nome } };
});

/** Para route handlers: devolve o funcionário ou a resposta de erro pronta. */
export async function exigirFuncionario(): Promise<Funcionario | Response> {
  const r = await verificarFuncionario();
  if (r.ok) return r.funcionario;
  return Response.json(
    { ok: false, erro: r.status === 401 ? 'Não autenticado' : 'Acesso negado' },
    { status: r.status },
  );
}
