'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function BotaoGerarFicha({ clienteId, rotulo }: { clienteId: string; rotulo: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function gerar() {
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await fetch('/api/fichas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId }),
      });
      const json = (await r.json().catch(() => null)) as { ok: boolean; erro?: string; data?: { acao?: string } } | null;
      if (!r.ok || !json?.ok) {
        setErro(json?.erro ?? `Erro ${r.status}`);
        return;
      }
      if (json.data?.acao === 'sem_mudanca') setAviso('A ficha já está com os dados atuais do RD.');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={gerar}
        disabled={pendente}
        className="h-10 rounded-sm bg-laranja px-4 text-sm font-bold text-white hover:bg-laranja-escuro disabled:opacity-60"
      >
        {pendente ? 'Gerando…' : rotulo}
      </button>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      {aviso && <p className="text-sm">{aviso}</p>}
    </div>
  );
}
