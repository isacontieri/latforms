import Image from 'next/image';

/**
 * Selo "Criado por Latitudes Lab". `rodape`: logo inteiro, no fim da página (cliente, convite).
 * `compacto`: logo pequeno numa plaquinha branca + texto (login e barra lateral escura).
 */
export function SeloLatitudesLab({ variante = 'rodape', escuro = false }: { variante?: 'rodape' | 'compacto'; escuro?: boolean }) {
  if (variante === 'compacto') {
    return (
      <span className={`flex items-center gap-2 text-xs ${escuro ? 'text-painel-apagado' : 'text-texto/50'}`}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-white p-0.5 shadow-sm">
          <Image src="/logo-latitudes-lab.png" alt="" width={335} height={418} className="h-full w-auto" aria-hidden />
        </span>
        Criado por Latitudes Lab
      </span>
    );
  }
  return (
    <footer className="mt-auto flex flex-col items-center gap-1.5 px-4 pt-12 pb-6">
      <span className="text-[11px] tracking-wide text-texto/50 uppercase">Criado por</span>
      <Image src="/logo-latitudes-lab.png" alt="Latitudes Lab" width={335} height={418} className="h-16 w-auto" />
    </footer>
  );
}
