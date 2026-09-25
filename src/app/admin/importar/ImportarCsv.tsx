'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MAX_LINHAS_LOTE, avisosDeDuplicidade, resumir, type DocContato, type ResultadoLinha } from '@/lib/importacao/lote';
import { extrairLinha, verificarCabecalhos } from '@/lib/rd/extrair';
import { decodificar, parseCsvRd, type CsvRd } from '@/lib/rd/parse-csv';

type Estado =
  | { tipo: 'inicio' }
  | { tipo: 'analisando'; feito: number; total: number }
  | { tipo: 'previa'; resultados: ResultadoLinha[] }
  | { tipo: 'importando'; feito: number; total: number }
  | { tipo: 'concluido'; resultados: ResultadoLinha[] }
  | { tipo: 'erro'; mensagem: string };

async function postar<T>(url: string, corpo: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const json = (await r.json().catch(() => null)) as { ok: boolean; data?: T; erro?: string } | null;
  if (!r.ok || !json?.ok) throw new Error(json?.erro ?? `Erro ${r.status}`);
  return json.data as T;
}

/** Mesmo CPF ou e-mail com IDs do RD diferentes dentro do arquivo inteiro (os lotes não se enxergam no servidor). */
function comDuplicadosNoArquivo(csv: CsvRd, resultados: ResultadoLinha[]): ResultadoLinha[] {
  const docs: DocContato[] = csv.linhas.flatMap((l, indice) => {
    const e = extrairLinha(l);
    return e.rdId ? [{ indice, rdId: e.rdId, nome: e.nome, cpf: e.dados.campos.cpf as string | null, email: e.email }] : [];
  });
  const avisos = avisosDeDuplicidade(docs, [], true);
  return resultados.map((r) => {
    const extra = (avisos.get(r.indice) ?? []).filter((a) => !r.avisos.includes(a));
    return extra.length ? { ...r, avisos: [...r.avisos, ...extra] } : r;
  });
}

function lotes<T>(itens: T[]): { inicio: number; itens: T[] }[] {
  const saida = [];
  for (let i = 0; i < itens.length; i += MAX_LINHAS_LOTE) saida.push({ inicio: i, itens: itens.slice(i, i + MAX_LINHAS_LOTE) });
  return saida;
}

export function ImportarCsv() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'inicio' });
  const [arquivo, setArquivo] = useState<{ nome: string; csv: CsvRd } | null>(null);

  async function analisar(file: File) {
    try {
      const csv = parseCsvRd(decodificar(new Uint8Array(await file.arrayBuffer())));
      if (csv.linhas.length === 0) throw new Error('O arquivo não tem contatos.');
      setArquivo({ nome: file.name, csv });

      const resultados: ResultadoLinha[] = [];
      setEstado({ tipo: 'analisando', feito: 0, total: csv.linhas.length });
      for (const lote of lotes(csv.linhas)) {
        const r = await postar<{ resultados: ResultadoLinha[] }>('/api/importacoes/previa', {
          inicio: lote.inicio,
          linhas: lote.itens,
        });
        resultados.push(...r.resultados);
        setEstado({ tipo: 'analisando', feito: resultados.length, total: csv.linhas.length });
      }
      setEstado({ tipo: 'previa', resultados: comDuplicadosNoArquivo(csv, resultados) });
    } catch (e) {
      setEstado({ tipo: 'erro', mensagem: (e as Error).message });
    }
  }

  async function confirmar() {
    if (!arquivo) return;
    const { csv, nome } = arquivo;
    try {
      const { id } = await postar<{ id: string }>('/api/importacoes', {
        arquivoNome: nome,
        totalLinhas: csv.linhas.length,
      });
      const resultados: ResultadoLinha[] = [];
      setEstado({ tipo: 'importando', feito: 0, total: csv.linhas.length });
      for (const lote of lotes(csv.linhas)) {
        const r = await postar<{ resultados: ResultadoLinha[] }>(`/api/importacoes/${id}/lote`, {
          inicio: lote.inicio,
          linhas: lote.itens,
        });
        resultados.push(...r.resultados);
        setEstado({ tipo: 'importando', feito: resultados.length, total: csv.linhas.length });
      }
      setEstado({ tipo: 'concluido', resultados: comDuplicadosNoArquivo(csv, resultados) });
    } catch (e) {
      setEstado({ tipo: 'erro', mensagem: `A importação parou no meio: ${(e as Error).message}. O que já foi gravado continua salvo; você pode importar o mesmo arquivo de novo sem duplicar.` });
    }
  }

  function recomecar() {
    setArquivo(null);
    setEstado({ tipo: 'inicio' });
  }

  const cabecalhos = arquivo ? verificarCabecalhos(arquivo.csv.cabecalhos) : null;

  return (
    <div className="flex flex-col gap-6">
      {estado.tipo === 'inicio' && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-sm border-2 border-dashed border-campo px-6 py-12 text-center hover:border-laranja">
          <span className="font-bold">Selecione o CSV exportado do RD Station</span>
          <span className="text-sm text-texto/70">O arquivo é lido no seu navegador e não fica guardado no sistema.</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && analisar(e.target.files[0])}
          />
        </label>
      )}

      {(estado.tipo === 'analisando' || estado.tipo === 'importando') && (
        <Progresso
          rotulo={estado.tipo === 'analisando' ? 'Analisando' : 'Importando'}
          feito={estado.feito}
          total={estado.total}
        />
      )}

      {estado.tipo === 'erro' && (
        <div className="flex flex-col gap-3 rounded-sm border border-red-300 bg-red-50 p-4">
          <p role="alert" className="text-sm text-red-800">{estado.mensagem}</p>
          <button onClick={recomecar} className="self-start text-sm underline underline-offset-4">
            Escolher outro arquivo
          </button>
        </div>
      )}

      {(estado.tipo === 'previa' || estado.tipo === 'concluido') && arquivo && cabecalhos && (
        <>
          <Resumo
            titulo={estado.tipo === 'previa' ? `Prévia de ${arquivo.nome}` : `Importação concluída: ${arquivo.nome}`}
            resultados={estado.resultados}
            concluido={estado.tipo === 'concluido'}
          />

          {arquivo.csv.erros.length > 0 && (
            <Aviso titulo="Problemas na estrutura do arquivo" itens={arquivo.csv.erros} />
          )}
          {cabecalhos.novas.length > 0 && (
            <Aviso
              titulo="Colunas novas (fora do catálogo) — serão guardadas em “Outras colunas do RD”"
              itens={cabecalhos.novas}
            />
          )}
          {cabecalhos.ausentes.length > 0 && (
            <Aviso titulo="Colunas do catálogo que não vieram neste arquivo" itens={cabecalhos.ausentes} />
          )}

          <TabelaLinhas resultados={estado.resultados} />

          <div className="flex flex-wrap gap-3">
            {estado.tipo === 'previa' ? (
              <>
                <button
                  onClick={confirmar}
                  disabled={resumir(estado.resultados).erros === estado.resultados.length}
                  className="h-10 rounded-sm bg-laranja px-5 font-bold text-white hover:bg-laranja-escuro disabled:opacity-60"
                >
                  Confirmar importação
                </button>
                <button onClick={recomecar} className="h-10 px-3 text-sm underline underline-offset-4">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <Link href="/admin" className="flex h-10 items-center rounded-sm bg-laranja px-5 font-bold text-white hover:bg-laranja-escuro">
                  Ver clientes
                </Link>
                <button onClick={recomecar} className="h-10 px-3 text-sm underline underline-offset-4">
                  Importar outro arquivo
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Progresso({ rotulo, feito, total }: { rotulo: string; feito: number; total: number }) {
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <span className="text-sm">
        {rotulo}… {feito} de {total} contatos
      </span>
      <div className="h-2 w-full overflow-hidden rounded-full bg-campo">
        <div className="h-full bg-laranja transition-all" style={{ width: `${total ? (feito / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function Resumo({ titulo, resultados, concluido }: { titulo: string; resultados: ResultadoLinha[]; concluido: boolean }) {
  const r = resumir(resultados);
  const itens = [
    { rotulo: concluido ? 'Criados' : 'Novos', valor: r.novos },
    { rotulo: 'Atualizados', valor: r.atualizados },
    { rotulo: 'Com erro (não importados)', valor: r.erros },
    { rotulo: 'Com aviso', valor: r.comAviso },
  ];
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-bold text-laranja">{titulo}</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {itens.map((i) => (
          <div key={i.rotulo} className="rounded-sm bg-campo/50 p-3">
            <dt className="text-xs">{i.rotulo}</dt>
            <dd className="text-2xl font-bold">{i.valor}</dd>
          </div>
        ))}
      </dl>
      {r.fichasAtualizadas > 0 && (
        <p className="text-sm">
          {r.fichasAtualizadas} ficha(s) {concluido ? 'foram atualizadas' : 'serão atualizadas'} com os dados novos do RD
          (o cliente ainda não tinha devolvido; o link continua o mesmo).
        </p>
      )}
      {r.devolvidasComRdNovo > 0 && (
        <p className="text-sm text-laranja-escuro">
          {r.devolvidasComRdNovo} cliente(s) já devolveram a ficha e o RD mudou depois. A versão do cliente é mantida;
          os dados novos do RD aparecem na página de cada cliente para comparação.
        </p>
      )}
    </section>
  );
}

function Aviso({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <details className="rounded-sm border border-campo p-3 text-sm">
      <summary className="cursor-pointer font-bold">
        {titulo} ({itens.length})
      </summary>
      <ul className="mt-2 list-disc pl-5">
        {itens.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </details>
  );
}

const ROTULO_STATUS = { novo: 'Novo', atualizado: 'Atualizado', erro: 'Erro' } as const;

function TabelaLinhas({ resultados }: { resultados: ResultadoLinha[] }) {
  const [todas, setTodas] = useState(false);
  const relevantes = resultados.filter(
    (r) => r.status === 'erro' || r.avisos.length > 0 || r.ficha === 'atualizada' || r.ficha === 'devolvida_rd_mudou',
  );
  const linhas = todas ? resultados : relevantes;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">
          {todas ? `Todos os contatos (${resultados.length})` : `Contatos com erro ou aviso (${relevantes.length})`}
        </h3>
        <button onClick={() => setTodas((v) => !v)} className="text-sm underline underline-offset-4">
          {todas ? 'Mostrar só erros e avisos' : 'Mostrar todos'}
        </button>
      </div>
      {linhas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-campo text-xs">
              <tr>
                <th className="py-2 pr-3 font-bold">#</th>
                <th className="py-2 pr-3 font-bold">Nome</th>
                <th className="py-2 pr-3 font-bold">Situação</th>
                <th className="py-2 font-bold">Observações</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((r) => (
                <tr key={r.indice} className="border-b border-campo/60 align-top">
                  <td className="py-2 pr-3 text-texto/60">{r.indice + 1}</td>
                  <td className="py-2 pr-3">{r.nome}</td>
                  <td className={`py-2 pr-3 ${r.status === 'erro' ? 'text-red-700' : ''}`}>{ROTULO_STATUS[r.status]}</td>
                  <td className="py-2">
                    <ul className="flex flex-col gap-0.5">
                      {r.erro && <li className="text-red-700">{r.erro}</li>}
                      {r.avisos.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                      {r.ficha === 'atualizada' && <li>Ficha atualizada com os dados novos do RD</li>}
                      {r.ficha === 'devolvida_rd_mudou' && (
                        <li className="text-laranja-escuro">Cliente já devolveu a ficha: versão dele mantida, RD novo fica para comparação</li>
                      )}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
