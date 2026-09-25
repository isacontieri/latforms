import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { verificarFuncionario } from '@/lib/auth';
import { ROTULOS_FICHA } from '@/lib/ficha/rotulos';
import { DadosFichaSchema, type DadosFicha } from '@/lib/ficha/schema';
import { ROTULO_STATUS } from '@/lib/ficha/status';
import { jsonIgual } from '@/lib/importacao/lote';
import { COLUNAS_RD, type ColunaRd, type Grupo, type ValorCampo } from '@/lib/rd/colunas';
import type { DadosRd } from '@/lib/rd/extrair';
import { criarClienteServidor } from '@/lib/supabase/server';
import { BotaoGerarFicha } from './BotaoGerarFicha';

export const metadata: Metadata = { title: 'Cliente — LatForms' };

const formatarData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

const ORDEM_GRUPOS: Grupo[] = [
  'Identificação', 'Contato', 'Documentos', 'Endereço', 'Emergência', 'Saúde',
  'Alimentação', 'Viagem', 'Observações', 'Comercial', 'RD', 'Interno',
];

/** Uma entrada por chave do catálogo (as colunas duplicadas do RD viram uma só). */
const CHAVES_POR_GRUPO = (() => {
  const vistas = new Set<string>();
  const mapa = new Map<Grupo, ColunaRd[]>();
  for (const c of COLUNAS_RD as readonly ColunaRd[]) {
    if (vistas.has(c.chave)) continue;
    vistas.add(c.chave);
    mapa.set(c.grupo, [...(mapa.get(c.grupo) ?? []), c]);
  }
  return mapa;
})();

function formatarValor(v: ValorCampo | boolean): string {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'number') return v.toLocaleString('pt-BR');
  return v ?? '';
}

const rotuloColuna = (c: ColunaRd) => c.coluna.replace(/:$/, '');

export default async function PaginaCliente({ params }: PageProps<'/admin/clientes/[id]'>) {
  const auth = await verificarFuncionario();
  if (!auth.ok) redirect('/login');

  const { id } = await params;
  const supabase = await criarClienteServidor();
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nome, email, rd_id, dados_rd, dados_ficha, criado_em, atualizado_em, fichas(id, versao, status, criado_em, dados_snapshot)')
    .eq('id', id)
    .order('versao', { referencedTable: 'fichas', ascending: false })
    .maybeSingle();
  if (!cliente) notFound();

  const dadosRd = cliente.dados_rd as unknown as DadosRd;
  const fichaAtual = DadosFichaSchema.safeParse(cliente.dados_ficha);
  const ultima = cliente.fichas[0];
  const desatualizada = ultima && !jsonIgual(ultima.dados_snapshot, cliente.dados_ficha);
  const extras = Object.entries(dadosRd.extras ?? {});

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <Link href="/admin" className="text-sm underline underline-offset-4 hover:text-laranja">← Clientes</Link>
        <h1 className="text-2xl font-bold">{cliente.nome}</h1>
        <p className="text-sm text-texto/70">
          {cliente.email ?? 'sem e-mail'} · ID RD {cliente.rd_id} · atualizado em {formatarData.format(new Date(cliente.atualizado_em))}
        </p>
      </div>

      {/* Fichas */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-laranja">Fichas</h2>
          <BotaoGerarFicha clienteId={cliente.id} rotulo={ultima ? 'Gerar nova versão' : 'Gerar ficha'} />
        </div>
        {desatualizada && (
          <p className="text-sm text-laranja-escuro">
            Os dados do RD mudaram desde a última ficha. Gere uma nova versão para o PDF sair com os dados atuais.
          </p>
        )}
        {cliente.fichas.length === 0 ? (
          <p className="text-sm">Nenhuma ficha gerada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-campo text-xs">
                <tr>
                  <th className="py-2 pr-3 font-bold">Versão</th>
                  <th className="py-2 pr-3 font-bold">Situação</th>
                  <th className="py-2 pr-3 font-bold">Criada em</th>
                  <th className="py-2 font-bold">PDF</th>
                </tr>
              </thead>
              <tbody>
                {cliente.fichas.map((f) => (
                  <tr key={f.id} className="border-b border-campo/60">
                    <td className="py-2 pr-3">v{f.versao}</td>
                    <td className="py-2 pr-3">{ROTULO_STATUS[f.status]}</td>
                    <td className="py-2 pr-3">{formatarData.format(new Date(f.criado_em))}</td>
                    <td className="py-2">
                      <a href={`/api/fichas/${f.id}/pdf?tipo=gerado`} className="font-bold text-laranja underline underline-offset-4">
                        Baixar PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* O que vai para o PDF */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-laranja">Dados que vão para a ficha</h2>
        {!fichaAtual.success ? (
          <p className="text-sm text-red-700">Os dados deste cliente não estão no formato da ficha. Reimporte o CSV.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(ROTULOS_FICHA) as (keyof DadosFicha)[]).map((k) => {
              const v = fichaAtual.data[k];
              return (
                <div key={k} className="flex flex-col gap-0.5">
                  <dt className="text-xs font-bold">{ROTULOS_FICHA[k]}</dt>
                  <dd className={`min-h-7 rounded-sm bg-campo px-2 py-1 text-sm whitespace-pre-line ${v === null ? 'text-texto/50 italic' : ''}`}>
                    {v === null ? 'cliente preenche' : formatarValor(v)}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </section>

      {/* Todas as colunas do RD */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-laranja">Todos os dados do RD Station</h2>
        {ORDEM_GRUPOS.map((grupo) => {
          const colunas = CHAVES_POR_GRUPO.get(grupo) ?? [];
          const preenchidas = colunas.filter((c) => {
            const v = dadosRd.campos?.[c.chave as keyof typeof dadosRd.campos];
            return v !== null && v !== undefined;
          });
          const vazias = colunas.length - preenchidas.length;
          if (colunas.length === 0) return null;
          return (
            <details key={grupo} open={preenchidas.length > 0} className="rounded-sm border border-campo p-3">
              <summary className="cursor-pointer text-sm font-bold">
                {grupo}{' '}
                <span className="font-normal text-texto/60">
                  ({preenchidas.length} preenchido{preenchidas.length === 1 ? '' : 's'}
                  {vazias > 0 ? `, ${vazias} vazio${vazias === 1 ? '' : 's'}` : ''})
                </span>
              </summary>
              {grupo === 'Interno' && (
                <p className="mt-2 text-xs text-laranja-escuro">Uso interno — nunca aparece para o cliente.</p>
              )}
              {preenchidas.length > 0 && (
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {preenchidas.map((c) => (
                    <div key={c.chave} className="flex flex-col">
                      <dt className="text-xs text-texto/70">
                        {rotuloColuna(c)}
                        {c.sensivel && <span title="Dado de saúde (LGPD)"> 🔒</span>}
                      </dt>
                      <dd className="whitespace-pre-line">
                        {formatarValor(dadosRd.campos[c.chave as keyof typeof dadosRd.campos])}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </details>
          );
        })}

        {extras.length > 0 && (
          <details open className="rounded-sm border border-campo p-3">
            <summary className="cursor-pointer text-sm font-bold">Outras colunas do RD ({extras.length})</summary>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {extras.map(([coluna, valor]) => (
                <div key={coluna} className="flex flex-col">
                  <dt className="text-xs text-texto/70">{coluna}</dt>
                  <dd className="whitespace-pre-line">{valor}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </section>
    </div>
  );
}
