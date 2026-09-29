'use client';

import { useMemo, useState } from 'react';
import { Ficha } from '@/components/ficha/Ficha';
import type { EstadoCampo } from '@/components/ficha/CampoFicha';
import { LegendaCores } from '@/components/ficha/LegendaCores';
import { mostrarValor, PainelAtividade } from '@/components/ficha/PainelAtividade';
import { useFichaAoVivo } from '@/hooks/useFichaAoVivo';
import { igual } from '@/lib/ficha/diff';
import type { EstadoFicha } from '@/lib/ficha/estado';
import { CAMPOS_LAYOUT } from '@/lib/ficha/layout';

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

type Visao = 'completa' | 'alterados';

/**
 * Ficha ao vivo: mesmo layout do cliente, somente leitura. Amarelo = valor atual ≠ original do RD
 * (revertido ao original não fica amarelo); contorno azul = campo em que o cliente está agora (se online).
 * "Só alterados" troca a ficha por uma lista com o antes e o depois de cada campo alterado.
 */
export function FichaAoVivo({ inicial, rodape }: { inicial: EstadoFicha; rodape?: React.ReactNode }) {
  const { estado, recentes, conexao, online, agora, piscar } = useFichaAoVivo(inicial);
  const [visao, setVisao] = useState<Visao>('completa');
  const [aba, setAba] = useState<'ficha' | 'atividade'>('ficha');

  const { estados, alterados } = useMemo(() => {
    const ultimaEdicao = new Map<string, string>();
    for (const e of estado.edicoes) if (!ultimaEdicao.has(e.campo)) ultimaEdicao.set(e.campo, e.em);
    const est: Record<string, EstadoCampo> = {};
    const lista: { chave: string; rotulo: string; antes: string | null; agora: string | null; quando?: string }[] = [];
    for (const { chave, rotulo } of CAMPOS_LAYOUT) {
      const alterado = !igual(estado.atuais[chave], estado.originais[chave]);
      const quando = ultimaEdicao.get(chave);
      const antes = estado.originais[chave] ?? null;
      if (alterado) lista.push({ chave, rotulo, antes, agora: estado.atuais[chave] ?? null, quando });
      est[chave] = {
        alterado,
        editando: online && estado.campoEmFoco === chave,
        recente: recentes.has(chave),
        dica: alterado ? `Antes: ${mostrarValor(antes)}${quando ? ` · Alterado às ${hora.format(new Date(quando))}` : ''}` : undefined,
      };
    }
    return { estados: est, alterados: lista };
  }, [estado, online, recentes]);

  const irPara = (campo: string) => {
    setAba('ficha');
    setVisao('completa');
    requestAnimationFrame(() => {
      document.querySelector(`[data-campo="${campo}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      piscar(campo);
    });
  };

  const painel = (
    <PainelAtividade
      status={estado.status}
      online={online}
      vistoEm={estado.clienteVistoEm}
      agora={agora}
      conexao={conexao}
      edicoes={estado.edicoes}
      onIrParaCampo={irPara}
      rodape={rodape}
    >
      <a
        href={`/api/fichas/${estado.id}/pdf`}
        className="flex h-10 items-center justify-center rounded-sm bg-laranja px-4 text-sm font-bold text-white hover:bg-laranja-escuro"
      >
        Baixar PDF
      </a>
    </PainelAtividade>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 lg:hidden" role="tablist">
        {(['ficha', 'atividade'] as const).map((a) => (
          <button
            key={a}
            role="tab"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
            className={`h-9 rounded-sm px-3 text-sm font-bold ${aba === a ? 'bg-laranja text-white' : 'bg-campo'}`}
          >
            {a === 'ficha' ? 'Ficha' : 'PDF e histórico'}
          </button>
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className={`flex flex-col gap-3 ${aba === 'ficha' ? '' : 'hidden lg:flex'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-sm bg-campo p-0.5 text-sm" role="group" aria-label="Visualização">
              {(
                [
                  ['completa', 'Ficha completa'],
                  ['alterados', `Só alterados (${alterados.length})`],
                ] as const
              ).map(([v, rotulo]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={visao === v}
                  onClick={() => setVisao(v)}
                  className={`h-8 rounded-[3px] px-3 font-bold ${visao === v ? 'bg-white shadow-sm' : 'text-texto/70 hover:text-texto'}`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            <LegendaCores />
          </div>

          {visao === 'completa' ? (
            <Ficha modo="consultora" valores={estado.atuais} estados={estados} somenteLeitura />
          ) : alterados.length === 0 ? (
            <p className="rounded-sm border border-campo p-6 text-center text-sm text-texto/60" data-testid="lista-alterados">
              O cliente ainda não alterou nenhum campo.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-campo rounded-sm border border-campo" data-testid="lista-alterados">
              {alterados.map((a) => (
                <li key={a.chave} className="flex flex-col gap-1 p-4 text-sm" data-alterado={a.chave}>
                  <div className="flex justify-between gap-3">
                    <span className="font-bold text-rotulo">{a.rotulo}</span>
                    {a.quando && <time className="shrink-0 text-xs text-texto/50">{hora.format(new Date(a.quando))}</time>}
                  </div>
                  <p className="w-fit rounded-sm bg-alterado px-2 py-1 break-words whitespace-pre-wrap">{mostrarValor(a.agora)}</p>
                  <p className="text-xs break-words text-texto/60">
                    Antes: <span className="line-through">{mostrarValor(a.antes)}</span>
                  </p>
                  <button type="button" onClick={() => irPara(a.chave)} className="w-fit text-xs text-laranja underline underline-offset-4">
                    Ver na ficha
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={`lg:sticky lg:top-4 lg:self-start ${aba === 'atividade' ? '' : 'hidden lg:block'}`}>{painel}</div>
      </div>
    </div>
  );
}
