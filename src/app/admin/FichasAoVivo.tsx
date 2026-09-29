'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { clienteOnline } from '@/lib/ficha/estado';
import { ROTULO_STATUS, type StatusFicha } from '@/lib/ficha/status';
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

  if (linhas.length === 0) return <p className="text-sm text-texto/60">Nenhuma ficha em andamento.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm" data-testid="fichas-ao-vivo">
        <thead className="border-b border-campo text-xs">
          <tr>
            <th className="py-2 pr-3 font-bold">Cliente</th>
            <th className="py-2 pr-3 font-bold">Situação</th>
            <th className="py-2 pr-3 font-bold">Preenchido</th>
            <th className="py-2 pr-3 font-bold" title="Alterações do cliente ainda não revisadas">A revisar</th>
            <th className="py-2 font-bold">Atualizada em</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const visto = [vistos[l.id], l.vistoEm].filter(Boolean).sort().at(-1) ?? null;
            const online = clienteOnline(visto, agora);
            return (
              <tr key={l.id} className="border-b border-campo/60" data-ficha={l.id}>
                <td className="py-2 pr-3">
                  <Link href={`/admin/fichas/${l.id}`} className="flex items-center gap-2 font-bold hover:text-laranja hover:underline">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${online ? 'bg-green-600' : 'bg-texto/20'}`}
                      title={online ? 'Cliente online' : 'Cliente offline'}
                      data-online={online}
                    />
                    {l.cliente}
                  </Link>
                </td>
                <td className="py-2 pr-3" data-status={l.status}>{ROTULO_STATUS[l.status]}</td>
                <td className="py-2 pr-3">{l.percentual}%</td>
                <td className="py-2 pr-3">
                  {l.alterados > 0 ? <span className="rounded-sm bg-alterado px-1.5 font-bold">{l.alterados}</span> : '0'}
                </td>
                <td className="py-2">{formatarData.format(new Date(l.atualizadoEm))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
