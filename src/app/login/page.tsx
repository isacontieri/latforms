import type { Metadata } from 'next';
import { Marca } from '@/components/Marca';
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
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Marca titulo="LatForms" />
        <p className="mt-6 mb-8 text-sm text-texto/80">
          Área da equipe Latitudes. O acesso é feito por convite de alguém da equipe; não há cadastro público.
        </p>
        {mensagem && <p className="mb-5 rounded-sm border border-green-700/30 bg-green-50 p-3 text-sm text-green-800">{mensagem}</p>}
        <FormLogin />
        <p className="mt-6 text-xs text-texto/70">Esqueceu a senha? Peça a alguém da equipe um link de nova senha (em Equipe).</p>
      </div>
    </main>
  );
}
