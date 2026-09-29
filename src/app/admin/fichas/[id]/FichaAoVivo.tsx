'use client';

import { useMemo, useState } from 'react';
import { Ficha } from '@/components/ficha/Ficha';
import type { EstadoCampo } from '@/components/ficha/CampoFicha';
import { PainelAtividade } from '@/components/ficha/PainelAtividade';
import { useFichaAoVivo } from '@/hooks/useFichaAoVivo';
import { igual } from '@/lib/ficha/diff';
import type { EstadoFicha } from '@/lib/ficha/estado';
import { CAMPOS_LAYOUT } from '@/lib/ficha/layout';
import { AcoesFicha } from './AcoesFicha';

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

/**
 * Ficha ao vivo: mesmo layout do cliente, somente leitura. Amarelo = valor atual ≠ original do RD
 * (revertido ao original não fica amarelo); contorno azul = campo em que o cliente está agora (se online).
 */
export function FichaAoVivo({ inicial, extras }: { inicial: EstadoFicha; extras?: React.ReactNode }) {
  const { estado, recentes, conexao, online, agora, piscar, recarregar } = useFichaAoVivo(inicial);
  const [somenteAlterados, setSomenteAlterados] = useState(false);
  const [aba, setAba] = useState<'ficha' | 'atividade'>('ficha');

  const { estados, nAlterados } = useMemo(() => {
    const ultimaEdicao = new Map<string, string>();
    for (const e of estado.edicoes) if (!ultimaEdicao.has(e.campo)) ultimaEdicao.set(e.campo, e.em);
    const est: Record<string, EstadoCampo> = {};
    let n = 0;
    for (const { chave } of CAMPOS_LAYOUT) {
      const alterado = !igual(estado.atuais[chave], estado.originais[chave]);
      if (alterado) n++;
      const quando = ultimaEdicao.get(chave);
      const antes = estado.originais[chave];
      est[chave] = {
        alterado,
        editando: online && estado.campoEmFoco === chave,
        recente: recentes.has(chave),
        esmaecido: somenteAlterados && !alterado,
        dica: alterado
          ? `Antes: ${antes === null || antes === undefined || antes === '' ? '(vazio)' : antes}${quando ? ` · Alterado às ${hora.format(new Date(quando))}` : ''}`
          : undefined,
      };
    }
    return { estados: est, nAlterados: n };
  }, [estado, online, recentes, somenteAlterados]);

  const irPara = (campo: string) => {
    setAba('ficha');
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
      nAlterados={nAlterados}
      somenteAlterados={somenteAlterados}
      onSomenteAlterados={setSomenteAlterados}
      edicoes={estado.edicoes}
      onIrParaCampo={irPara}
    >
      <div className="flex flex-col gap-3">
        <AcoesFicha fichaId={estado.id} status={estado.status} onMudou={() => void recarregar()} />
        {extras}
      </div>
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
            {a === 'ficha' ? 'Ficha' : `Atividade (${nAlterados})`}
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={aba === 'ficha' ? '' : 'hidden lg:block'}>
          <Ficha modo="consultora" valores={estado.atuais} estados={estados} somenteLeitura />
        </div>
        <div className={`lg:sticky lg:top-4 lg:self-start ${aba === 'atividade' ? '' : 'hidden lg:block'}`}>{painel}</div>
      </div>
    </div>
  );
}
