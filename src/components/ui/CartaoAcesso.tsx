import { SeloLatitudesLab } from '@/components/SeloLatitudesLab';
import { MarcaPainel } from './MarcaPainel';

/** Tela de acesso (login, convite): cartão branco centralizado sobre o fundo escuro, como no Estoque. */
export function CartaoAcesso({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-painel px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-sm bg-white px-6 py-8 shadow-2xl sm:px-8">
        <MarcaPainel subtitulo="Latitudes - Formatação de formulários" />
        {children}
        <div className="flex justify-center border-t border-borda pt-5">
          <SeloLatitudesLab variante="compacto" />
        </div>
      </div>
    </main>
  );
}
