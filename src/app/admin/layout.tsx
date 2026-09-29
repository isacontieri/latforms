import { redirect } from 'next/navigation';
import { SeloLatitudesLab } from '@/components/SeloLatitudesLab';
import { MarcaPainel } from '@/components/ui/MarcaPainel';
import { NavLateral } from '@/components/ui/NavLateral';
import { verificarConsultora } from '@/lib/auth';
import { sair } from '../login/actions';

/**
 * Layout e página renderizam em paralelo: esta checagem só decide o que MOSTRAR.
 * Toda página ou rota que busca dados precisa chamar `verificarConsultora()`/`exigirConsultora()` de novo.
 */
export default async function LayoutAdmin({ children }: LayoutProps<'/admin'>) {
  const auth = await verificarConsultora();
  if (!auth.ok && auth.status === 401) redirect('/login');

  if (!auth.ok) {
    return (
      <main className="flex flex-1 items-center justify-center bg-painel px-4 py-12">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-sm bg-white p-8 shadow-xl">
          <MarcaPainel />
          <h1 className="text-lg font-bold">Acesso negado</h1>
          <p className="text-sm">Sua conta existe, mas não está cadastrada como consultora do LatForms. Fale com a administração.</p>
          <form action={sair}>
            <button type="submit" className="text-sm underline underline-offset-4 hover:text-laranja">
              Sair
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-superficie lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-5 bg-painel px-3 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:gap-8 lg:py-6">
        <div className="px-2">
          <MarcaPainel escuro />
        </div>
        <div className="border-t border-white/10 lg:hidden" />
        <NavLateral />
        <div className="mt-auto hidden flex-col gap-4 border-t border-white/10 px-2 pt-4 lg:flex">
          <p className="text-xs text-painel-apagado">
            Logado como <strong className="text-white">{auth.consultora.nome}</strong>
          </p>
          <SeloLatitudesLab variante="compacto" escuro />
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
