/** Legenda das cores do painel ao vivo (os mesmos tokens do globals.css). */
export function LegendaCores() {
  const itens = [
    { amostra: 'bg-alterado ring-1 ring-alterado-borda', texto: 'Alterado pelo cliente' },
    { amostra: 'bg-campo outline-2 outline-editando', texto: 'Cliente está neste campo agora' },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto/70" aria-label="Legenda das cores">
      {itens.map((i) => (
        <li key={i.texto} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-5 shrink-0 rounded-[2px] ${i.amostra}`} aria-hidden />
          {i.texto}
        </li>
      ))}
    </ul>
  );
}
