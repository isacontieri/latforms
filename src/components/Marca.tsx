/** Assinatura visual da ficha: "Latitudes" + título em laranja. Trocar pelo logo oficial quando houver o arquivo. */
export function Marca({ titulo }: { titulo?: string }) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
      <span className="text-2xl tracking-[0.2em] text-texto uppercase">Latitudes</span>
      {titulo && <span className="text-sm font-bold tracking-wide text-laranja uppercase">{titulo}</span>}
    </div>
  );
}
