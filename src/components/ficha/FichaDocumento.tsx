'use client';

import { LAYOUT } from '@/lib/ficha/layout';
import { CampoFicha, type EstadoCampo } from './CampoFicha';

export interface PropsFicha {
  modo: 'cliente' | 'consultora';
  /** dados_atuais */
  valores: Record<string, string | null>;
  somenteLeitura?: boolean;
  /** Estado visual por campo (amarelo, azul, pulso, ✓, erro, dica). */
  estados?: Record<string, EstadoCampo>;
  onChange?: (campo: string, valor: string) => void;
  onFocusCampo?: (campo: string | null) => void;
}

/**
 * A ficha com a cara do PDF (≥ 768 px): uma "folha" por página, com o fundo gerado do PDF e os campos
 * posicionados nas coordenadas do ficha-layout.json. A fonte acompanha a largura (container queries).
 * A ordem do DOM (e do Tab) é a ordem de leitura do layout.
 */
export function FichaDocumento({ modo, valores, somenteLeitura, estados = {}, onChange, onFocusCampo }: PropsFicha) {
  return (
    <div className="flex w-full flex-col items-center gap-6" data-modo={modo}>
      {LAYOUT.paginas.map((pagina) => (
        <section
          key={pagina.numero}
          aria-label={`Ficha de cadastro — página ${pagina.numero} de ${LAYOUT.paginas.length}`}
          className="ficha-pagina relative w-full max-w-[900px] bg-white shadow-sm ring-1 ring-campo"
          style={{
            aspectRatio: `${LAYOUT.pagina.largura_pt} / ${LAYOUT.pagina.altura_pt}`,
            backgroundImage: `url(/ficha/${pagina.fundo})`,
            backgroundSize: '100% 100%',
          }}
        >
          {LAYOUT.campos
            .filter((c) => c.pagina === pagina.numero)
            .map((campo) => (
              <div
                key={campo.chave}
                className="ficha-caixa"
                style={{
                  left: `${campo.pos.left}%`,
                  top: `${campo.pos.top}%`,
                  width: `${campo.pos.width}%`,
                  height: `${campo.pos.height}%`,
                }}
              >
                <CampoFicha
                  campo={campo}
                  variante="documento"
                  valor={valores[campo.chave] ?? null}
                  estado={estados[campo.chave]}
                  somenteLeitura={somenteLeitura}
                  onChange={(v) => onChange?.(campo.chave, v)}
                  onFocus={() => onFocusCampo?.(campo.chave)}
                  onBlur={() => onFocusCampo?.(null)}
                />
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
