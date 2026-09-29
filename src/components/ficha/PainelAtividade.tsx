'use client';

import { CAMPO_LAYOUT } from '@/lib/ficha/layout';
import type { Edicao } from '@/lib/ficha/estado';
import { ROTULO_STATUS, type StatusFicha } from '@/lib/ficha/status';

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

export function haQuanto(iso: string | null, agora: number): string {
  if (!iso) return 'nunca';
  const s = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `em ${dia.format(new Date(iso))}`;
}

export const mostrarValor = (v: string | null | undefined) => (v === null || v === undefined || v.trim() === '' ? '(vazio)' : v);

/** Painel lateral da ficha ao vivo: situação, cliente online, ações, histórico. */
export function PainelAtividade({
  status,
  online,
  vistoEm,
  agora,
  conexao,
  edicoes,
  onIrParaCampo,
  children,
  rodape,
}: {
  status: StatusFicha;
  online: boolean;
  vistoEm: string | null;
  agora: number;
  conexao: 'conectando' | 'ao_vivo' | 'reconectando';
  edicoes: Edicao[];
  onIrParaCampo: (campo: string) => void;
  children?: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <aside className="flex flex-col gap-5 text-sm" aria-label="Atividade da ficha">
      <div className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-campo px-2.5 py-0.5 text-xs font-bold" data-status={status}>
          {ROTULO_STATUS[status]}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-texto/70" data-online={online}>
          <span className={`h-2 w-2 rounded-full ${online ? 'bg-green-600' : 'bg-texto/30'}`} aria-hidden />
          {online ? <strong className="text-green-800">Cliente online agora</strong> : `Cliente offline · visto ${haQuanto(vistoEm, agora)}`}
        </span>
        {conexao !== 'ao_vivo' && (
          <p className="text-xs text-texto/60" aria-live="polite">
            {conexao === 'conectando' ? 'Conectando…' : 'Reconectando… (os dados continuam salvos)'}
          </p>
        )}
      </div>

      {children}

      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-bold tracking-wide text-texto/60 uppercase">Histórico</h2>
        {edicoes.length === 0 ? (
          <p className="text-texto/60">O cliente ainda não alterou nada.</p>
        ) : (
          <ol className="-mx-2 flex max-h-[50vh] flex-col overflow-y-auto" data-testid="historico">
            {edicoes.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onIrParaCampo(e.campo)} className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-campo/50">
                  <span className="flex justify-between gap-2 text-xs">
                    <span className="font-bold">{CAMPO_LAYOUT.get(e.campo)?.rotulo ?? e.campo}</span>
                    <time dateTime={e.em} className="shrink-0 text-texto/50">
                      {hora.format(new Date(e.em))}
                    </time>
                  </span>
                  <span className="block text-xs break-words text-texto/70">
                    <span className="line-through opacity-60">{mostrarValor(e.anterior)}</span> → {mostrarValor(e.novo)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {rodape}
    </aside>
  );
}
