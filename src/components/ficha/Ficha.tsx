'use client';

import { useSyncExternalStore } from 'react';
import { FichaDocumento, type PropsFicha } from './FichaDocumento';
import { FichaLista } from './FichaLista';

const CONSULTA = '(min-width: 768px)';
type Formato = 'documento' | 'lista' | 'ambos';

function assinar(cb: () => void) {
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/**
 * Documento (layout do PDF) a partir de 768 px; lista empilhada abaixo disso (o A4 fica ilegível no celular).
 * O servidor não sabe o tamanho da tela: ele manda os dois e o CSS esconde o errado desde o 1º instante
 * (sem "piscar" o A4 no celular); depois de carregar, fica só o formato certo (sem campos duplicados).
 */
export function Ficha(props: PropsFicha) {
  const formato = useSyncExternalStore<Formato>(
    assinar,
    () => (window.matchMedia(CONSULTA).matches ? 'documento' : 'lista'),
    () => 'ambos',
  );
  if (formato === 'documento') return <FichaDocumento {...props} />;
  if (formato === 'lista') return <FichaLista {...props} />;
  return (
    <>
      <div className="hidden w-full md:block">
        <FichaDocumento {...props} />
      </div>
      <div className="w-full md:hidden">
        <FichaLista {...props} />
      </div>
    </>
  );
}
