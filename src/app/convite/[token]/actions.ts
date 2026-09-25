'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ipDaRequisicao, registrarAuditoria } from '@/lib/audit';
import { buscarConviteValido, marcarUsado } from '@/lib/equipe/convites';
import { mensagemSenha, problemasDaSenha } from '@/lib/equipe/senha';
import { consumirRateLimit } from '@/lib/rate-limit';
import { criarClienteAdmin } from '@/lib/supabase/admin';

export interface EstadoConvite {
  erro: string | null;
}

const LINK_INVALIDO = 'Este link não é mais válido. Peça um novo link a alguém da equipe.';

/** Aceita o convite (cria a conta e o cadastro de funcionário) ou define a senha nova. */
export async function aceitarConvite(token: string, _anterior: EstadoConvite, form: FormData): Promise<EstadoConvite> {
  const ip = ipDaRequisicao(await headers()) ?? 'desconhecido';
  if (!(await consumirRateLimit(`convite:${ip}`, 10, 600))) {
    return { erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' };
  }

  const convite = await buscarConviteValido(token);
  if (!convite) return { erro: LINK_INVALIDO };

  const nome = String(form.get('nome') ?? '').trim();
  const senha = String(form.get('senha') ?? '');
  const confirmacao = String(form.get('confirmacao') ?? '');
  if (convite.tipo === 'convite' && (nome.length < 2 || nome.length > 120)) return { erro: 'Informe seu nome.' };
  const problema = mensagemSenha(problemasDaSenha(senha));
  if (problema) return { erro: problema };
  if (senha !== confirmacao) return { erro: 'As duas senhas não são iguais.' };

  // reserva o link antes de mexer na conta (dois envios simultâneos não usam o mesmo link)
  if (!(await marcarUsado(convite.id))) return { erro: LINK_INVALIDO };
  const admin = criarClienteAdmin();
  const liberar = () => admin.from('convites_equipe').update({ usado_em: null }).eq('id', convite.id);

  try {
    let usuarioId = convite.usuarioId;
    if (convite.tipo === 'nova_senha') {
      if (!usuarioId) throw new Error('link de nova senha sem usuário');
      const { error } = await admin.auth.admin.updateUserById(usuarioId, { password: senha });
      if (error) throw error;
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email: convite.email, password: senha, email_confirm: true });
      if (error?.code === 'email_exists') {
        // conta já existia no Auth sem acesso ao LatForms: o link prova que a equipe autorizou
        const existente = await buscarUsuarioPorEmail(convite.email);
        if (!existente) throw error;
        usuarioId = existente;
        const { error: e2 } = await admin.auth.admin.updateUserById(usuarioId, { password: senha });
        if (e2) throw e2;
      } else if (error || !data.user) {
        throw error ?? new Error('criar usuário');
      } else {
        usuarioId = data.user.id;
      }
      const { error: e3 } = await admin.from('funcionarios').upsert({ id: usuarioId, nome, email: convite.email });
      if (e3) throw e3;
    }
    await registrarAuditoria({
      ator: `funcionario:${usuarioId}`,
      acao: convite.tipo === 'convite' ? `convite_equipe_aceito:${convite.id}` : 'senha_redefinida_por_link',
    });
  } catch (e) {
    await liberar();
    console.error('convite: falha', { tipo: convite.tipo, code: (e as { code?: string }).code ?? (e as Error).name });
    if ((e as { code?: string }).code === 'weak_password') return { erro: 'O sistema recusou a senha por ser fraca. Escolha outra.' };
    return { erro: 'Não foi possível concluir agora. Tente de novo em instantes.' };
  }

  redirect(convite.tipo === 'convite' ? '/login?ok=conta' : '/login?ok=senha');
}

async function buscarUsuarioPorEmail(email: string): Promise<string | null> {
  const admin = criarClienteAdmin();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 200) return null;
  }
  return null;
}
