'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { clienteOnline } from '@/lib/ficha/estado';
import { TABELA } from '@/components/ui/Cartao';
import { SeloStatus } from '@/components/ui/SeloStatus';
import type { StatusFicha } from '@/lib/ficha/status';
import { criarClienteNavegador } from '@/lib/supabase/client';

export interface LinhaFicha {
  id: string;
  cliente: string;
  status: StatusFicha;
  percentual: number;
  alterados: number;
  vistoEm: string | null;
  atualizadoEm: string;
}

const formatarData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

/**
 * Lista de fichas em andamento, ao vivo pelo canal PRIVADO fichas:lista. Presença só atualiza o
 * "online" localmente; edição e mudança de status recarregam os dados do servidor (com folga de 1,5 s).
 */
export function FichasAoVivo({ linhas }: { linhas: LinhaFicha[] }) {
  const router = useRouter();
  const [vistos, setVistos] = useState<Record<string, string>>({});
  const [agora, setAgora] = useState(() => Date.now());
  const pendente = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = criarClienteNavegador();
    let ativo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;
    const atualizar = () => {
      if (pendente.current) return;
      pendente.current = setTimeout(() => {
        pendente.current = null;
        router.refresh();
      }, 1500);
    };
    (async () => {
      await supabase.realtime.setAuth();
      if (!ativo) return;
      canal = supabase
        .channel('fichas:lista', { config: { private: true } })
        .on('broadcast', { event: 'presenca' }, ({ payload }) => {
          const p = payload as { fichaId: string; em: string };
          setVistos((v) => ({ ...v, [p.fichaId]: p.em }));
        })
        .on('broadcast', { event: 'campo_atualizado' }, atualizar)
        .on('broadcast', { event: 'status' }, atualizar)
        .on('broadcast', { event: 'revisado' }, atualizar)
        .subscribe();
    })();
    const relogio = setInterval(() => setAgora(Date.now()), 10_000);
    return () => {
      ativo = false;
      clearInterval(relogio);
      if (pendente.current) clearTimeout(pendente.current);
      if (canal) void supabase.removeChannel(canal);
    };
  }, [router]);

  if (linhas.length === 0) return <p className="p-4 text-sm text-texto/60">Nenhuma ficha em andamento.</p>;

  return (
    <div className="overflow-x-auto">
      <table className={`${TABELA.tabela} min-w-[44rem]`} data-testid="fichas-ao-vivo">
        <thead>
          <tr>
            <th className={TABELA.th}>Cliente</th>
            <th className={TABELA.th}>Situação</th>
            <th className={TABELA.th}>Preenchido</th>
            <th className={TABELA.th} title="Campos alterados pelo cliente ainda não revisados">
              A revisar
            </th>
            <th className={TABELA.th}>Atualizada em</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const visto = [vistos[l.id], l.vistoEm].filter(Boolean).sort().at(-1) ?? null;
            const online = clienteOnline(visto, agora);
            return (
              <tr key={l.id} className={TABELA.tr} data-ficha={l.id}>
                <td className={TABELA.td}>
                  <Link href={`/admin/fichas/${l.id}`} className="flex items-center gap-2 font-bold hover:text-laranja hover:underline">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${online ? 'bg-green-600' : 'bg-texto/20'}`}
                      title={online ? 'Cliente online' : 'Cliente offline'}
                      data-online={online}
                    />
                    {l.cliente}
                  </Link>
                </td>
                <td className={TABELA.td}>
                  <SeloStatus status={l.status} curto />
                </td>
                <td className={TABELA.td}>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-borda">
                      <span className="block h-full bg-laranja" style={{ width: `${l.percentual}%` }} />
                    </span>
                    <span className="font-mono text-xs">{l.percentual}%</span>
                  </span>
                </td>
                <td className={TABELA.td}>
                  {l.alterados > 0 ? (
                    <span className="rounded-sm bg-alterado px-1.5 font-bold">{l.alterados}</span>
                  ) : (
                    <span className="text-texto/40">0</span>
                  )}
                </td>
                <td className={TABELA.data}>{formatarData.format(new Date(l.atualizadoEm))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
