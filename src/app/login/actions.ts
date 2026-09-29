'use server';

import { redirect } from 'next/navigation';
import { registrarAuditoria } from '@/lib/audit';
import { criarClienteServidor } from '@/lib/supabase/server';

export interface EstadoLogin {
  erro: string | null;
}

export async function entrar(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const email = String(form.get('email') ?? '').trim();
  const senha = String(form.get('senha') ?? '');
  if (!email || !senha) return { erro: 'Informe e-mail e senha.' };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error || !data.user) {
    await registrarAuditoria({ ator: 'anonimo', acao: 'login_falhou' });
    if (!error || error.code === 'invalid_credentials') return { erro: 'E-mail ou senha incorretos.' };
    // Problema de configuração/serviço (ex.: provedor de e-mail desligado): não culpar a senha.
    console.error('login: erro do Supabase Auth', { code: error.code, status: error.status });
    return { erro: `Não foi possível entrar agora (código: ${error.code ?? error.status}). Avise o responsável pelo sistema.` };
  }

  await registrarAuditoria({ ator: `consultora:${data.user.id}`, acao: 'login' });
  redirect('/admin');
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user) await registrarAuditoria({ ator: `consultora:${user.id}`, acao: 'logout' });
  redirect('/login');
}
