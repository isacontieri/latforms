import type { Metadata } from 'next';
import { CartaoAcesso } from '@/components/ui/CartaoAcesso';
import { FormLogin } from './FormLogin';

export const metadata: Metadata = { title: 'Entrar — LatForms' };

const MENSAGENS: Record<string, string> = {
  conta: 'Acesso criado! Entre com seu e-mail e a senha que você acabou de definir.',
  senha: 'Senha alterada. Entre com a senha nova.',
};

export default async function PaginaLogin({ searchParams }: PageProps<'/login'>) {
  const ok = (await searchParams).ok;
  const mensagem = typeof ok === 'string' ? MENSAGENS[ok] : undefined;
  return (
    <CartaoAcesso>
      {mensagem && <p className="rounded-sm border border-green-700/30 bg-green-50 p-3 text-sm text-green-800">{mensagem}</p>}
      <FormLogin />
      <p className="text-xs text-texto/60">Esqueceu a senha? Peça a alguém da equipe um link de nova senha (em Equipe). O acesso é só por convite.</p>
    </CartaoAcesso>
  );
}
