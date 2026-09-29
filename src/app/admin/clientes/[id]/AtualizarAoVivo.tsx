'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { criarClienteNavegador } from '@/lib/supabase/client';

/**
 * Mantém a página do cliente em dia com a ficha: escuta o canal PRIVADO ficha:<id> e, a cada edição,
 * mudança de status ou revisão, recarrega os dados do servidor (com folga de 1 s). Também ao voltar à aba.
 */
export function AtualizarAoVivo({ fichaId }: { fichaId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = criarClienteNavegador();
    let ativo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let pendente: ReturnType<typeof setTimeout> | null = null;
    const atualizar = () => {
      if (pendente) return;
      pendente = setTimeout(() => {
        pendente = null;
        router.refresh();
      }, 1000);
    };
    (async () => {
      await supabase.realtime.setAuth();
      if (!ativo) return;
      canal = supabase
        .channel(`ficha:${fichaId}`, { config: { private: true } })
        .on('broadcast', { event: 'campo_atualizado' }, atualizar)
        .on('broadcast', { event: 'status' }, atualizar)
        .on('broadcast', { event: 'revisado' }, atualizar)
        .subscribe();
    })();
    const aoVoltar = () => document.visibilityState === 'visible' && atualizar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      ativo = false;
      if (pendente) clearTimeout(pendente);
      document.removeEventListener('visibilitychange', aoVoltar);
      if (canal) void supabase.removeChannel(canal);
    };
  }, [fichaId, router]);
  return null;
}
