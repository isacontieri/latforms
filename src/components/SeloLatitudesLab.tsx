import Image from 'next/image';

/** Selo discreto no rodapé de todas as páginas. */
export function SeloLatitudesLab() {
  return (
    <footer className="mt-auto flex flex-col items-center gap-1.5 px-4 pt-12 pb-6">
      <span className="text-[11px] tracking-wide text-texto/50 uppercase">Criado por</span>
      <Image src="/logo-latitudes-lab.png" alt="Latitudes Lab" width={335} height={418} className="h-16 w-auto" />
    </footer>
  );
}
