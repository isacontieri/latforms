import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { verificarFuncionario } from '@/lib/auth';
import { mapearParaFicha } from '@/lib/ficha/mapping';
import { DadosFichaSchema, type DadosFicha } from '@/lib/ficha/schema';
import { ROTULO_STATUS, aceitaDadosDoRd, proximoStatus } from '@/lib/ficha/status';
import { jsonIgual } from '@/lib/importacao/lote';
import { COLUNAS_RD, type ChaveRd, type ColunaRd, type Grupo, type ValorCampo } from '@/lib/rd/colunas';
import type { DadosRd } from '@/lib/rd/extrair';
import { criarClienteServidor } from '@/lib/supabase/server';
import { BotaoGerarFicha } from './BotaoGerarFicha';
import { DadosDaFicha } from './DadosDaFicha';
import { LinkDoCliente, type LinkAtivo } from './LinkDoCliente';

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

function formatarValor(v: ValorCampo): string {
  if (Array.isArray(v)) return v.join(', ');
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
    .select(
      'id, nome, email, rd_id, dados_rd, criado_em, atualizado_em, fichas(id, versao, status, criado_em, snapshot_atualizado_em, dados_snapshot, dados_respondidos, respondida_em, tokens_acesso(expira_em, revogado_em, usos, ultimo_acesso_em))',
    )
    .eq('id', id)
    .order('criado_em', { referencedTable: 'fichas', ascending: false })
    .maybeSingle();
  if (!cliente) notFound();

  const dadosRd = cliente.dados_rd as unknown as DadosRd | null;
  // RD atual, sempre no modelo atual da ficha
  const versaoRd: DadosFicha | null = dadosRd?.campos ? mapearParaFicha(dadosRd.campos) : null;
  const ficha = cliente.fichas.find((f) => f.status !== 'cancelada') ?? null; // no máximo uma (índice único)
  const canceladas = cliente.fichas.filter((f) => f.status === 'cancelada');
  const devolvida = ficha !== null && !aceitaDadosDoRd(ficha.status);
  const versaoCliente = ficha?.dados_respondidos ? DadosFichaSchema.safeParse(ficha.dados_respondidos) : null;
  const pendenteAtualizar = ficha && !devolvida && versaoRd && !jsonIgual(ficha.dados_snapshot, versaoRd);
  const extras = Object.entries(dadosRd?.extras ?? {});
  const agora = new Date();
  const token = ficha?.tokens_acesso.find((t) => !t.revogado_em && new Date(t.expira_em) > agora) ?? null;
  const linkAtivo: LinkAtivo | null = token
    ? { expiraEm: token.expira_em, usos: token.usos, ultimoAcessoEm: token.ultimo_acesso_em }
    : null;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <Link href="/admin" className="text-sm underline underline-offset-4 hover:text-laranja">← Clientes</Link>
        <h1 className="text-2xl font-bold">{cliente.nome}</h1>
        <p className="text-sm text-texto/70">
          {cliente.email ?? 'sem e-mail'} · ID RD {cliente.rd_id} · atualizado em {formatarData.format(new Date(cliente.atualizado_em))}
        </p>
      </div>

      {/* A ficha (uma por cliente) */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-laranja">Ficha</h2>
          {!ficha && <BotaoGerarFicha clienteId={cliente.id} rotulo="Gerar ficha" />}
          {ficha && !devolvida && <BotaoGerarFicha clienteId={cliente.id} rotulo="Atualizar ficha com o RD" />}
        </div>

        {!ficha ? (
          <p className="text-sm">Nenhuma ficha gerada ainda.</p>
        ) : (
          <div className="flex flex-col gap-2 rounded-sm border border-campo p-4 text-sm">
            <div className="flex flex-wrap gap-x-8 gap-y-1">
              <span><span className="font-bold">Situação:</span> {ROTULO_STATUS[ficha.status]}</span>
              <span><span className="font-bold">Criada em:</span> {formatarData.format(new Date(ficha.criado_em))}</span>
              {ficha.snapshot_atualizado_em && (
                <span>
                  <span className="font-bold">Atualizada com o RD em:</span> {formatarData.format(new Date(ficha.snapshot_atualizado_em))}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <a href={`/api/fichas/${ficha.id}/pdf?tipo=gerado`} className="font-bold text-laranja underline underline-offset-4">
                Baixar PDF {devolvida ? '(como foi enviado ao cliente)' : ''}
              </a>
            </div>
            {ficha.respondida_em && (
              <p>
                <span className="font-bold">Devolvida pelo cliente em:</span> {formatarData.format(new Date(ficha.respondida_em))}
              </p>
            )}
            <LinkDoCliente
              fichaId={ficha.id}
              nomeCliente={cliente.nome}
              emailCliente={cliente.email}
              remetente={auth.funcionario.nome}
              ativo={linkAtivo}
              podeGerar={proximoStatus(ficha.status, 'gerar_link') !== null}
            />
            {pendenteAtualizar && (
              <p className="text-laranja-escuro">Os dados do RD mudaram desde a última atualização da ficha. Clique em “Atualizar ficha com o RD”.</p>
            )}
            {devolvida && (
              <p className="text-texto/70">
                O cliente já devolveu a ficha: vale a versão dele. Novas importações do RD não alteram a ficha; os dados novos
                aparecem abaixo para comparação.
              </p>
            )}
          </div>
        )}
        {canceladas.length > 0 && (
          <p className="text-xs text-texto/60">{canceladas.length} ficha(s) cancelada(s) no histórico.</p>
        )}
      </section>

      {!versaoRd ? (
        <p className="text-sm text-red-700">Os dados do RD deste cliente estão incompletos. Reimporte o CSV.</p>
      ) : devolvida ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-laranja">Versão do cliente (ficha devolvida)</h2>
            {versaoCliente?.success ? (
              <DadosDaFicha dados={versaoCliente.data} />
            ) : (
              <p className="text-sm">Os dados lidos do PDF devolvido aparecem aqui.</p>
            )}
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-laranja">Versão atual do RD Station</h2>
            <DadosDaFicha
              dados={versaoRd}
              compararCom={versaoCliente?.success ? versaoCliente.data : null}
              rotuloComparacao="da versão do cliente (destacados em laranja)."
            />
          </section>
        </>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-laranja">Dados que vão para a ficha</h2>
          <DadosDaFicha dados={versaoRd} />
        </section>
      )}

      {/* Todas as colunas do RD */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-laranja">Todos os dados do RD Station</h2>
        {ORDEM_GRUPOS.map((grupo) => {
          const colunas = CHAVES_POR_GRUPO.get(grupo) ?? [];
          const preenchidas = colunas.filter((c) => {
            const v = dadosRd?.campos?.[c.chave as ChaveRd];
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
                        {formatarValor(dadosRd?.campos?.[c.chave as ChaveRd] ?? null)}
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
