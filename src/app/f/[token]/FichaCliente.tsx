'use client';

import { useCallback, useRef, useState } from 'react';
import { Ficha } from '@/components/ficha/Ficha';
import type { EstadoCampo } from '@/components/ficha/CampoFicha';
import { useAutosave, type EstadoSalvamento } from '@/hooks/useAutosave';
import { usePresenca } from '@/hooks/usePresenca';
import { CAMPO_LAYOUT, obrigatoriosFaltando, validarValor } from '@/lib/ficha/layout';
import { editavelPeloCliente, type StatusFicha } from '@/lib/ficha/status';

const TEXTO_ESTADO: Record<EstadoSalvamento, string> = {
  ocioso: 'Tudo é salvo automaticamente.',
  salvando: 'Salvando…',
  salvo: 'Salvo ✓',
  offline: 'Sem conexão — tentaremos de novo',
  erro: 'Não conseguimos salvar agora — tentaremos de novo',
};

export function FichaCliente({
  token,
  statusInicial,
  valoresIniciais,
}: {
  token: string;
  statusInicial: StatusFicha;
  valoresIniciais: Record<string, string | null>;
}) {
  const [valores, setValores] = useState(valoresIniciais);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvos, setSalvos] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState(statusInicial);
  const [faltando, setFaltando] = useState<{ campo: string; rotulo: string }[]>([]);
  const [concluindo, setConcluindo] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const emFoco = useRef<string | null>(null);
  const somenteLeitura = !editavelPeloCliente(status);

  const definirErro = (campo: string, erro: string | null) =>
    setErros((e) => {
      const n = { ...e };
      if (erro) n[campo] = erro;
      else delete n[campo];
      return n;
    });

  const autosave = useAutosave(token, {
    onSalvo: (campo) => {
      setSalvos((s) => new Set(s).add(campo));
      setTimeout(() => setSalvos((s) => { const n = new Set(s); n.delete(campo); return n; }), 1500);
    },
    onRecusado: (campo, erro, codigo) => {
      if (codigo === 422) definirErro(campo, erro);
      else setErroGeral(erro);
      if (codigo === 409) setStatus('concluida');
    },
  });
  const mudarPresenca = usePresenca(token, !somenteLeitura);

  const aoMudar = useCallback(
    (campo: string, bruto: string) => {
      setValores((v) => ({ ...v, [campo]: bruto }));
      setFaltando((f) => f.filter((x) => x.campo !== campo));
      const r = validarValor(campo, bruto);
      if (r.ok) {
        definirErro(campo, null);
        autosave.agendar(campo, r.valor, CAMPO_LAYOUT.get(campo)?.tipo === 'select');
      }
      // valor inválido não é enviado; a mensagem aparece ao sair do campo
    },
    [autosave],
  );

  const aoFocar = useCallback(
    (campo: string | null) => {
      if (campo === null && emFoco.current) {
        const saiu = emFoco.current;
        const r = validarValor(saiu, valores[saiu] ?? null);
        definirErro(saiu, r.ok ? null : r.erro);
        autosave.descarregar();
      }
      emFoco.current = campo;
      mudarPresenca(campo);
    },
    [autosave, mudarPresenca, valores],
  );

  async function concluir() {
    setErroGeral(null);
    const locais = obrigatoriosFaltando(valores);
    if (locais.length) {
      setFaltando(locais.map((k) => ({ campo: k, rotulo: CAMPO_LAYOUT.get(k)?.rotulo ?? k })));
      return;
    }
    if (Object.keys(erros).length) {
      setErroGeral('Corrija os campos marcados em vermelho antes de concluir.');
      return;
    }
    setConcluindo(true);
    autosave.descarregar();
    for (let i = 0; i < 50 && autosave.temPendencia(); i++) await new Promise((r) => setTimeout(r, 100));
    const r = await fetch(`/api/f/${token}/concluir`, { method: 'POST' });
    const json = (await r.json().catch(() => null)) as { ok: boolean; erro?: string; faltando?: { campo: string; rotulo: string }[] } | null;
    setConcluindo(false);
    if (r.ok && json?.ok) {
      setStatus('concluida');
      mudarPresenca(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (json?.faltando) setFaltando(json.faltando);
    setErroGeral(json?.erro ?? 'Não foi possível concluir agora. Tente de novo.');
  }

  const irPara = (campo: string) => {
    const el = document.querySelector<HTMLElement>(`[data-campo="${campo}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  };

  const estados: Record<string, EstadoCampo> = {};
  for (const [k, e] of Object.entries(erros)) estados[k] = { ...estados[k], erro: e };
  for (const k of salvos) estados[k] = { ...estados[k], salvo: true };
  for (const f of faltando) estados[f.campo] = { ...estados[f.campo], erro: estados[f.campo]?.erro ?? 'Campo obrigatório' };

  return (
    <div className="flex flex-col gap-6">
      {somenteLeitura ? (
        <div className="rounded-sm border border-green-700/30 bg-green-50 p-4 text-green-900">
          <p className="font-bold">Ficha enviada, obrigado!</p>
          <p className="mt-1 text-sm">A equipe Latitudes vai conferir as informações. Se precisar mudar algo, fale com a sua consultora.</p>
          <a href={`/api/f/${token}/pdf`} className="mt-3 inline-flex h-10 items-center rounded-sm bg-laranja px-4 text-sm font-bold text-white hover:bg-laranja-escuro">
            Baixar cópia em PDF
          </a>
        </div>
      ) : (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-campo bg-white/95 py-3 backdrop-blur">
          <p className="text-sm" aria-live="polite">
            <span className={autosave.estado === 'offline' || autosave.estado === 'erro' ? 'font-bold text-laranja-escuro' : ''}>
              {TEXTO_ESTADO[autosave.estado]}
            </span>
          </p>
          <button
            type="button"
            onClick={concluir}
            disabled={concluindo}
            className="h-10 rounded-sm bg-laranja px-5 text-sm font-bold text-white hover:bg-laranja-escuro disabled:opacity-60"
          >
            {concluindo ? 'Enviando…' : 'Concluir ficha'}
          </button>
        </div>
      )}

      {(faltando.length > 0 || erroGeral) && (
        <div role="alert" className="rounded-sm border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {erroGeral && <p>{erroGeral}</p>}
          {faltando.length > 0 && (
            <>
              <p className="font-bold">Para concluir, preencha:</p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {faltando.map((f) => (
                  <li key={f.campo}>
                    <button type="button" onClick={() => irPara(f.campo)} className="underline underline-offset-2">
                      {f.rotulo}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <Ficha modo="cliente" valores={valores} estados={estados} somenteLeitura={somenteLeitura} onChange={aoMudar} onFocusCampo={aoFocar} />
    </div>
  );
}
