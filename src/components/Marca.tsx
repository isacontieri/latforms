import Image from 'next/image';

/** Logo Latitudes (extraído do modelo da ficha) + título em laranja, como no cabeçalho do PDF. */
export function Marca({ titulo }: { titulo?: string }) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
      <Image src="/logo-latitudes.png" alt="Latitudes" width={120} height={36} priority />
      {titulo && <span className="pb-0.5 text-sm font-bold tracking-wide text-laranja uppercase">{titulo}</span>}
    </div>
  );
}
