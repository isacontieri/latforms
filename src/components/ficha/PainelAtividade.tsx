'use client';

import { CAMPO_LAYOUT } from '@/lib/ficha/layout';
import type { Edicao } from '@/lib/ficha/estado';
import { ROTULO_STATUS, type StatusFicha } from '@/lib/ficha/status';
import { LegendaCores } from './LegendaCores';

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

const mostrar = (v: string | null) => (v === null || v.trim() === '' ? '(vazio)' : v);

export function PainelAtividade({
  status,
  online,
  vistoEm,
  agora,
  conexao,
  nAlterados,
  somenteAlterados,
  onSomenteAlterados,
  edicoes,
  onIrParaCampo,
  children,
}: {
  status: StatusFicha;
  online: boolean;
  vistoEm: string | null;
  agora: number;
  conexao: 'conectando' | 'ao_vivo' | 'reconectando';
  nAlterados: number;
  somenteAlterados: boolean;
  onSomenteAlterados: (v: boolean) => void;
  edicoes: Edicao[];
  onIrParaCampo: (campo: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <aside className="flex flex-col gap-4 text-sm" aria-label="Atividade da ficha">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-campo px-2.5 py-0.5 text-xs font-bold" data-status={status}>
          {ROTULO_STATUS[status]}
        </span>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${online ? 'bg-green-100 text-green-800' : 'bg-campo/60 text-texto/70'}`}
          data-online={online}
        >
          <span className={`h-2 w-2 rounded-full ${online ? 'bg-green-600' : 'bg-texto/40'}`} aria-hidden />
          {online ? 'Cliente online' : `Cliente offline · visto ${haQuanto(vistoEm, agora)}`}
        </span>
      </div>
      <p className="text-xs text-texto/60" aria-live="polite">
        {conexao === 'ao_vivo' ? 'Ao vivo — atualiza sozinho' : conexao === 'conectando' ? 'Conectando…' : 'Reconectando… (os dados continuam salvos)'}
      </p>

      {children}

      <div className="flex flex-col gap-2 border-t border-campo pt-3">
        <p>
          <strong data-testid="n-alterados">{nAlterados}</strong> campo(s) alterado(s) pelo cliente
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={somenteAlterados} onChange={(e) => onSomenteAlterados(e.target.checked)} />
          Mostrar só alterados
        </label>
        <LegendaCores />
      </div>

      <div className="flex flex-col gap-2 border-t border-campo pt-3">
        <h2 className="font-bold">Histórico</h2>
        {edicoes.length === 0 ? (
          <p className="text-texto/60">Nenhuma alteração ainda.</p>
        ) : (
          <ol className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto pr-1" data-testid="historico">
            {edicoes.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onIrParaCampo(e.campo)}
                  className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-campo/50"
                >
                  <span className="flex justify-between gap-2 text-xs text-texto/60">
                    <span className="font-bold text-texto">{CAMPO_LAYOUT.get(e.campo)?.rotulo ?? e.campo}</span>
                    <time dateTime={e.em}>{hora.format(new Date(e.em))}</time>
                  </span>
                  <span className="block break-words text-xs">
                    <span className="text-texto/50 line-through">{mostrar(e.anterior)}</span> → <span>{mostrar(e.novo)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
