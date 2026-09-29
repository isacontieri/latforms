import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Marca } from '@/components/Marca';
import { verificarConsultora } from '@/lib/auth';
import { sair } from '../login/actions';

function BotaoSair() {
  return (
    <form action={sair}>
      <button type="submit" className="text-sm underline underline-offset-4 hover:text-laranja">
        Sair
      </button>
    </form>
  );
}

/**
 * Layout e página renderizam em paralelo: esta checagem só decide o que MOSTRAR.
 * Toda página ou rota que busca dados precisa chamar `verificarConsultora()`/`exigirConsultora()` de novo.
 */
export default async function LayoutAdmin({ children }: LayoutProps<'/admin'>) {
  const auth = await verificarConsultora();
  if (!auth.ok && auth.status === 401) redirect('/login');

  if (!auth.ok) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-12">
        <Marca titulo="LatForms" />
        <h1 className="text-lg font-bold">Acesso negado</h1>
        <p className="text-sm">Sua conta existe, mas não está cadastrada como consultora do LatForms. Fale com a administração.</p>
        <BotaoSair />
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-campo">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <Marca titulo="LatForms" />
            <nav className="flex gap-4 text-sm">
              <Link href="/admin" className="hover:text-laranja">Clientes</Link>
              <Link href="/admin/importar" className="hover:text-laranja">Importar CSV</Link>
              <Link href="/admin/equipe" className="hover:text-laranja">Equipe</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span>{auth.consultora.nome}</span>
            <BotaoSair />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
