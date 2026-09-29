'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clienteOnline, type Edicao, type EstadoFicha } from '@/lib/ficha/estado';
import type { StatusFicha } from '@/lib/ficha/status';
import { criarClienteNavegador } from '@/lib/supabase/client';

const PISCAR_MS = 2000;

export type Conexao = 'conectando' | 'ao_vivo' | 'reconectando';

/**
 * Acompanha a ficha ao vivo: canal PRIVADO ficha:<id> (só consultoras recebem, pela política no banco).
 * O banco é a fonte da verdade: ao assinar, ao reconectar e ao voltar à aba, recarrega o estado do banco,
 * então nada se perde se uma mensagem falhar.
 */
export function useFichaAoVivo(inicial: EstadoFicha) {
  const [estado, setEstado] = useState(inicial);
  const [recentes, setRecentes] = useState<Set<string>>(new Set());
  const [conexao, setConexao] = useState<Conexao>('conectando');
  const [agora, setAgora] = useState(() => Date.now());
  const fichaId = inicial.id;
  const proximoIdLocal = useRef(-1);

  const piscar = useCallback((campo: string) => {
    setRecentes((r) => new Set(r).add(campo));
    setTimeout(() => setRecentes((r) => { const n = new Set(r); n.delete(campo); return n; }), PISCAR_MS);
  }, []);

  const recarregar = useCallback(async () => {
    const r = await fetch(`/api/fichas/${fichaId}/estado`, { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) return;
    const json = (await r.json()) as { ok: boolean; data?: EstadoFicha };
    if (json.ok && json.data) setEstado(json.data);
  }, [fichaId]);

  useEffect(() => {
    const supabase = criarClienteNavegador();
    let ativo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await supabase.realtime.setAuth(); // JWT da sessão da consultora
      if (!ativo) return;
      canal = supabase
        .channel(`ficha:${fichaId}`, { config: { private: true } })
        .on('broadcast', { event: 'campo_atualizado' }, ({ payload }) => {
          const p = payload as { campo: string; anterior: unknown; novo: unknown; em: string };
          const novo = p.novo === null || p.novo === undefined ? null : String(p.novo);
          const edicao: Edicao = {
            id: proximoIdLocal.current--,
            campo: p.campo,
            anterior: p.anterior === null || p.anterior === undefined ? null : String(p.anterior),
            novo,
            origem: 'cliente',
            em: p.em,
          };
          setEstado((e) => ({ ...e, atuais: { ...e.atuais, [p.campo]: novo }, edicoes: [edicao, ...e.edicoes] }));
          piscar(p.campo);
        })
        .on('broadcast', { event: 'presenca' }, ({ payload }) => {
          const p = payload as { campo: string | null; em: string };
          setEstado((e) => ({ ...e, campoEmFoco: p.campo, clienteVistoEm: p.em }));
        })
        .on('broadcast', { event: 'status' }, ({ payload }) => {
          const p = payload as { status: StatusFicha; em: string };
          setEstado((e) => ({ ...e, status: p.status, ...(p.status === 'concluida' ? { concluidaEm: p.em, campoEmFoco: null } : {}) }));
        })
        // outra consultora marcou como revisado: a foto fica no banco, então recarrega
        .on('broadcast', { event: 'revisado' }, () => void recarregar())
        .subscribe((s) => {
          if (s === 'SUBSCRIBED') {
            setConexao('ao_vivo');
            void recarregar();
          } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
            setConexao('reconectando');
          }
        });
    })();

    const aoVoltar = () => document.visibilityState === 'visible' && void recarregar();
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', aoVoltar);
    const relogio = setInterval(() => setAgora(Date.now()), 10_000); // reavalia "cliente online"
    return () => {
      ativo = false;
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', aoVoltar);
      clearInterval(relogio);
      if (canal) void supabase.removeChannel(canal);
    };
  }, [fichaId, piscar, recarregar]);

  return { estado, recentes, conexao, online: clienteOnline(estado.clienteVistoEm, agora), agora, recarregar, piscar };
}
