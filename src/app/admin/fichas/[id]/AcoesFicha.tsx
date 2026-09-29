'use client';

import { useState, useTransition } from 'react';
import { proximoStatus, type StatusFicha } from '@/lib/ficha/status';

type Acao = 'aprovar' | 'reabrir' | 'cancelar';

const ROTULO: Record<Acao, string> = { aprovar: 'Aprovar ficha', reabrir: 'Reabrir para o cliente', cancelar: 'Cancelar ficha' };
const CONFIRMAR: Partial<Record<Acao, string>> = {
  cancelar: 'O link do cliente deixa de funcionar e a ficha sai da lista. Confirmar?',
  reabrir: 'O cliente volta a poder editar a ficha pelo mesmo link. Confirmar?',
};

/** Ações da consultora sobre a ficha (seguem o status ao vivo). */
export function AcoesFicha({ fichaId, status, onMudou }: { fichaId: string; status: StatusFicha; onMudou: () => void }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<Acao | null>(null);

  const executar = (acao: Acao) =>
    iniciar(async () => {
      setErro(null);
      const r = await fetch(`/api/fichas/${fichaId}/${acao}`, { method: 'POST' });
      const json = (await r.json().catch(() => null)) as { ok: boolean; erro?: string } | null;
      setConfirmando(null);
      if (!r.ok || !json?.ok) setErro(json?.erro ?? `Erro ${r.status}`);
      onMudou();
    });

  const disponiveis = (['aprovar', 'reabrir', 'cancelar'] as Acao[]).filter((a) => proximoStatus(status, a) !== null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {disponiveis.map((a) =>
          confirmando === a ? (
            <span key={a} className="flex flex-wrap items-center gap-2 text-xs">
              {CONFIRMAR[a]}
              <button type="button" disabled={pendente} onClick={() => executar(a)} className="font-bold text-red-700 underline underline-offset-4">
                Sim
              </button>
              <button type="button" onClick={() => setConfirmando(null)} className="underline underline-offset-4">
                Não
              </button>
            </span>
          ) : (
            <button
              key={a}
              type="button"
              disabled={pendente}
              onClick={() => (CONFIRMAR[a] ? setConfirmando(a) : executar(a))}
              className={
                a === 'aprovar'
                  ? 'h-9 rounded-sm bg-laranja px-3 text-sm font-bold text-white hover:bg-laranja-escuro disabled:opacity-60'
                  : a === 'cancelar'
                    ? 'h-9 px-2 text-sm text-red-700 underline underline-offset-4'
                    : 'h-9 rounded-sm bg-campo px-3 text-sm font-bold hover:bg-campo/70'
              }
            >
              {ROTULO[a]}
            </button>
          ),
        )}
        <a href={`/api/fichas/${fichaId}/pdf`} className="flex h-9 items-center px-2 text-sm font-bold text-laranja underline underline-offset-4">
          Baixar PDF
        </a>
      </div>
      {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
    </div>
  );
}
