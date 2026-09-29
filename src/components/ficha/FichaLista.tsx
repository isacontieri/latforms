'use client';

import { CAMPOS_LAYOUT } from '@/lib/ficha/layout';
import type { CampoLayout } from '@/lib/ficha/layout-gerar';
import { CampoFicha } from './CampoFicha';
import type { PropsFicha } from './FichaDocumento';

const SECOES: [string, CampoLayout[]][] = (() => {
  const mapa = new Map<string, CampoLayout[]>();
  for (const c of CAMPOS_LAYOUT) mapa.set(c.secao, [...(mapa.get(c.secao) ?? []), c]);
  return [...mapa.entries()];
})();

/** Modo lista para celular (< 768 px): os mesmos campos empilhados por seção, rótulo acima. Mesmas props. */
export function FichaLista({ modo, valores, somenteLeitura, estados = {}, onChange, onFocusCampo }: PropsFicha) {
  return (
    <div className="flex w-full flex-col gap-6" data-modo={modo}>
      {SECOES.map(([titulo, campos]) => (
        <fieldset key={titulo} className="flex flex-col gap-4 rounded-sm border border-campo p-4">
          <legend className="px-1 text-sm font-bold tracking-wide text-laranja uppercase">{titulo}</legend>
          {campos.map((campo) => (
            <label key={campo.chave} className="relative flex flex-col gap-1">
              <span className="text-sm font-bold text-rotulo">{campo.rotulo}</span>
              <CampoFicha
                campo={campo}
                variante="lista"
                valor={valores[campo.chave] ?? null}
                estado={estados[campo.chave]}
                somenteLeitura={somenteLeitura}
                onChange={(v) => onChange?.(campo.chave, v)}
                onFocus={() => onFocusCampo?.(campo.chave)}
                onBlur={() => onFocusCampo?.(null)}
              />
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
