'use client';

import { useSyncExternalStore } from 'react';
import { FichaDocumento, type PropsFicha } from './FichaDocumento';
import { FichaLista } from './FichaLista';

const CONSULTA = '(min-width: 768px)';

function assinar(cb: () => void) {
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** Documento (layout do PDF) a partir de 768 px; lista empilhada abaixo disso (o A4 fica ilegível no celular). */
export function Ficha(props: PropsFicha) {
  const largo = useSyncExternalStore(assinar, () => window.matchMedia(CONSULTA).matches, () => true);
  return largo ? <FichaDocumento {...props} /> : <FichaLista {...props} />;
}
