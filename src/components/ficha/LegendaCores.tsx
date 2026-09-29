/** Legenda das cores do painel ao vivo (os mesmos tokens do globals.css). */
export function LegendaCores() {
  const itens = [
    { amostra: 'bg-alterado ring-1 ring-alterado-borda', texto: 'Alterado pelo cliente (diferente do que veio do RD)' },
    { amostra: 'bg-campo outline-2 outline-editando', texto: 'Campo em que o cliente está agora' },
    { amostra: 'bg-campo', texto: 'Sem alteração' },
  ];
  return (
    <ul className="flex flex-col gap-1.5 text-xs" aria-label="Legenda das cores">
      {itens.map((i) => (
        <li key={i.texto} className="flex items-center gap-2">
          <span className={`inline-block h-3.5 w-6 shrink-0 rounded-[2px] ${i.amostra}`} aria-hidden />
          {i.texto}
        </li>
      ))}
    </ul>
  );
}
