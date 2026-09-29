import Image from 'next/image';

/** Selo discreto no rodapé de todas as páginas. */
export function SeloLatitudesLab() {
  return (
    <footer className="mt-auto flex justify-center px-4 pt-10 pb-6">
      <span className="flex items-center gap-1.5 rounded-full border border-campo px-3 py-1 text-xs text-texto/60">
        <Image src="/icon.png" alt="" width={14} height={14} aria-hidden />
        Criado por <strong className="font-bold text-texto/80">Latitudes Lab</strong>
      </span>
    </footer>
  );
}
