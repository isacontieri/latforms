import { Icone } from './Icone';

/** Marca do LatForms no estilo do Estoque: ícone de linha, nome condensado e "Latitudes" embaixo. */
export function MarcaPainel({ escuro = false, subtitulo = 'Latitudes' }: { escuro?: boolean; subtitulo?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Icone nome="ficha" className={`h-7 w-7 ${escuro ? 'text-laranja' : 'text-texto'}`} />
      <div className="flex flex-col gap-0.5">
        <span className={`font-titulo text-3xl leading-none font-bold tracking-wide uppercase ${escuro ? 'text-white' : 'text-texto'}`}>LatForms</span>
        <span className={`text-xs tracking-[0.14em] uppercase ${escuro ? 'text-painel-apagado' : 'text-slate-500'}`}>{subtitulo}</span>
      </div>
    </div>
  );
}
