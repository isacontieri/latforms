'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type EstadoSalvamento = 'ocioso' | 'salvando' | 'salvo' | 'offline' | 'erro';

const DEBOUNCE_MS = 800;
const ESPERAS_MS = [1000, 2000, 5000, 10000];

interface Opcoes {
  onSalvo?: (campo: string) => void;
  /** Resposta definitiva do servidor para o campo (valor inválido, ficha já enviada…): não tenta de novo. */
  onRecusado?: (campo: string, erro: string, status: number) => void;
}

/**
 * Fila de salvamento por campo: só o último valor de cada campo vai para o servidor.
 * Texto espera 800 ms sem digitar (ou sai na hora no blur); listas saem na hora.
 * Sem conexão: tenta de novo com espera crescente (1 s, 2 s, 5 s, 10 s) e ao voltar o "online".
 */
export function useAutosave(token: string, opcoes: Opcoes = {}) {
  const pendentes = useRef(new Map<string, string | null>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const emVoo = useRef(false);
  const tentativa = useRef(0);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opcoesRef = useRef(opcoes);
  const [estado, setEstado] = useState<EstadoSalvamento>('ocioso');

  useEffect(() => {
    opcoesRef.current = opcoes;
  });

  const enviarFila = useCallback(async () => {
    if (emVoo.current) return;
    emVoo.current = true;
    try {
      while (pendentes.current.size > 0) {
        const [campo, valor] = pendentes.current.entries().next().value as [string, string | null];
        pendentes.current.delete(campo);
        setEstado('salvando');
        let r: Response;
        try {
          r = await fetch(`/api/f/${token}/campos`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campo, valor }),
            keepalive: true,
          });
        } catch {
          r = new Response(null, { status: 0 });
        }

        if (r.ok) {
          tentativa.current = 0;
          opcoesRef.current.onSalvo?.(campo);
          continue;
        }
        if ([400, 401, 404, 409, 422].includes(r.status)) {
          const json = (await r.json().catch(() => null)) as { erro?: string } | null;
          opcoesRef.current.onRecusado?.(campo, json?.erro ?? 'Não foi possível salvar este campo.', r.status);
          if (r.status !== 422) setEstado('erro');
          continue;
        }
        // rede, 429 ou 5xx: devolve à fila (se não chegou valor mais novo) e tenta de novo depois
        if (!pendentes.current.has(campo)) pendentes.current.set(campo, valor);
        setEstado(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'erro');
        const espera = ESPERAS_MS[Math.min(tentativa.current++, ESPERAS_MS.length - 1)];
        if (retry.current) clearTimeout(retry.current);
        retry.current = setTimeout(() => void enviarFila(), espera);
        return;
      }
      setEstado((e) => (e === 'erro' ? e : 'salvo'));
    } finally {
      emVoo.current = false;
    }
  }, [token]);

  /** Agenda o envio de um campo. `imediato` para listas e para o blur. */
  const agendar = useCallback(
    (campo: string, valor: string | null, imediato = false) => {
      pendentes.current.set(campo, valor);
      const t = timers.current.get(campo);
      if (t) clearTimeout(t);
      if (imediato) {
        timers.current.delete(campo);
        void enviarFila();
      } else {
        timers.current.set(campo, setTimeout(() => {
          timers.current.delete(campo);
          void enviarFila();
        }, DEBOUNCE_MS));
      }
    },
    [enviarFila],
  );

  /** Envia agora o que estiver pendente (ex.: ao sair do campo). */
  const descarregar = useCallback(() => {
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
    void enviarFila();
  }, [enviarFila]);

  const temPendencia = useCallback(() => pendentes.current.size > 0 || timers.current.size > 0 || emVoo.current, []);

  useEffect(() => {
    const aoVoltar = () => {
      tentativa.current = 0;
      void enviarFila();
    };
    const aoSair = (e: BeforeUnloadEvent) => {
      if (!temPendencia()) return;
      descarregar();
      e.preventDefault();
    };
    window.addEventListener('online', aoVoltar);
    window.addEventListener('beforeunload', aoSair);
    return () => {
      window.removeEventListener('online', aoVoltar);
      window.removeEventListener('beforeunload', aoSair);
    };
  }, [enviarFila, descarregar, temPendencia]);

  return { estado, agendar, descarregar, temPendencia };
}
