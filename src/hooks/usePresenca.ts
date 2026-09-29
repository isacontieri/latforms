'use client';

import { useCallback, useEffect, useRef } from 'react';

const THROTTLE_MS = 1000;
const HEARTBEAT_MS = 30_000;

/**
 * Presença do cliente: avisa o campo em foco (throttle de 1 s — foco/desfoco rápidos viram 1 envio)
 * e manda um heartbeat a cada 30 s só com a aba visível. O 1º envio marca a ficha como "aberta".
 */
export function usePresenca(token: string, ativo: boolean) {
  const atual = useRef<string | null>(null);
  const ultimoEnvio = useRef(0);
  const agendado = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enviar = useCallback(() => {
    ultimoEnvio.current = Date.now();
    void fetch(`/api/f/${token}/presenca`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo: atual.current }),
      keepalive: true,
    }).catch(() => {});
  }, [token]);

  const mudarCampo = useCallback(
    (campo: string | null) => {
      atual.current = campo;
      if (!ativo) return;
      if (agendado.current) clearTimeout(agendado.current);
      const falta = THROTTLE_MS - (Date.now() - ultimoEnvio.current);
      if (falta <= 0) enviar();
      else agendado.current = setTimeout(enviar, falta);
    },
    [ativo, enviar],
  );

  useEffect(() => {
    if (!ativo) return;
    const visivel = () => document.visibilityState === 'visible';
    if (visivel()) enviar();
    const intervalo = setInterval(() => visivel() && enviar(), HEARTBEAT_MS);
    const aoMudarVisibilidade = () => visivel() && enviar();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      if (agendado.current) clearTimeout(agendado.current);
    };
  }, [ativo, enviar]);

  return mudarCampo;
}
