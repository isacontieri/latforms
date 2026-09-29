import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Cartao } from '@/components/ui/Cartao';
import { Pagina } from '@/components/ui/Pagina';
import { SeloStatus } from '@/components/ui/SeloStatus';
import { verificarConsultora } from '@/lib/auth';
import { mapearParaFicha } from '@/lib/ficha/mapping';
import { DadosFichaSchema, type DadosFicha } from '@/lib/ficha/schema';
import { aceitaDadosDoRd, proximoStatus } from '@/lib/ficha/status';
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
  const auth = await verificarConsultora();
  if (!auth.ok) redirect('/login');

  const { id } = await params;
  const supabase = await criarClienteServidor();
  const { data: cliente } = await supabase
    .from('clientes')
    .select(
      'id, nome, email, rd_id, dados_rd, criado_em, atualizado_em, fichas(id, status, criado_em, atualizado_em, concluida_em, dados_originais, dados_atuais, tokens_acesso(expira_em, revogado_em, usos, ultimo_acesso_em))',
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
  // o cliente já editou algum campo: a ficha não acompanha mais o RD
  const clienteEditou = ficha !== null && !aceitaDadosDoRd(ficha.status);
  const dadosAtuais = ficha ? DadosFichaSchema.safeParse(ficha.dados_atuais) : null;
  const pendenteAtualizar = ficha && !clienteEditou && versaoRd && !jsonIgual(ficha.dados_originais, versaoRd);
  const rdMudouDepois = ficha && clienteEditou && versaoRd && !jsonIgual(ficha.dados_originais, versaoRd);
  const extras = Object.entries(dadosRd?.extras ?? {});
  const agora = new Date();
  const token = ficha?.tokens_acesso.find((t) => !t.revogado_em && new Date(t.expira_em) > agora) ?? null;
  const linkAtivo: LinkAtivo | null = token
    ? { expiraEm: token.expira_em, usos: token.usos, ultimoAcessoEm: token.ultimo_acesso_em }
    : null;

  return (
    <Pagina
      secao="Clientes"
      voltar={{ href: '/admin/clientes', rotulo: 'Cliente' }}
      titulo={cliente.nome}
      descricao={`${cliente.email ?? 'sem e-mail'} · ID RD ${cliente.rd_id} · atualizado em ${formatarData.format(new Date(cliente.atualizado_em))}`}
    >
      {/* A ficha (uma por cliente) */}
      <Cartao
        titulo="Ficha"
        acoes={
          <>
            {!ficha && <BotaoGerarFicha clienteId={cliente.id} rotulo="Gerar ficha" />}
            {ficha && !clienteEditou && <BotaoGerarFicha clienteId={cliente.id} rotulo="Atualizar ficha com o RD" />}
          </>
        }
      >

        {!ficha ? (
          <p className="text-sm">Nenhuma ficha gerada ainda.</p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
              <SeloStatus status={ficha.status} />
              <span><span className="font-bold">Criada em:</span> {formatarData.format(new Date(ficha.criado_em))}</span>
              <span><span className="font-bold">Última alteração:</span> {formatarData.format(new Date(ficha.atualizado_em))}</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <Link href={`/admin/fichas/${ficha.id}`} className="flex h-9 items-center rounded-sm bg-laranja px-4 font-bold text-white hover:bg-laranja-escuro">
                Acompanhar ficha ao vivo
              </Link>
              <a href={`/api/fichas/${ficha.id}/pdf`} className="flex h-9 items-center rounded-sm border border-borda px-4 font-bold hover:border-texto/40">
                Baixar PDF
              </a>
            </div>
            {ficha.concluida_em && (
              <p>
                <span className="font-bold">Concluída pelo cliente em:</span> {formatarData.format(new Date(ficha.concluida_em))}
              </p>
            )}
            <LinkDoCliente
              fichaId={ficha.id}
              nomeCliente={cliente.nome}
              emailCliente={cliente.email}
              remetente={auth.consultora.nome}
              ativo={linkAtivo}
              podeGerar={proximoStatus(ficha.status, 'gerar_link') !== null}
            />
            {pendenteAtualizar && (
              <p className="text-laranja-escuro">Os dados do RD mudaram desde a última atualização da ficha. Clique em “Atualizar ficha com o RD”.</p>
            )}
            {clienteEditou && (
              <p className="text-texto/70">
                O cliente já começou a preencher: vale o que ele informou. Novas importações do RD não alteram a ficha
                {rdMudouDepois ? '; o RD mudou depois disso e os dados novos aparecem abaixo para comparação.' : '.'}
              </p>
            )}
          </div>
        )}
        {canceladas.length > 0 && (
          <p className="mt-3 text-xs text-texto/60">{canceladas.length} ficha(s) cancelada(s) no histórico.</p>
        )}
      </Cartao>

      {!versaoRd ? (
        <p className="text-sm text-red-700">Os dados do RD deste cliente estão incompletos. Reimporte o CSV.</p>
      ) : clienteEditou && dadosAtuais?.success ? (
        <>
          <Cartao titulo="Ficha agora">
            <DadosDaFicha
              dados={dadosAtuais.data}
              compararCom={DadosFichaSchema.safeParse(ficha.dados_originais).data ?? null}
              rotuloComparacao="alterado(s) pelo cliente em relação ao que veio do RD (destacados em laranja)."
            />
          </Cartao>
          {rdMudouDepois && (
            <Cartao titulo="RD Station atual (só para comparação)">
              <DadosDaFicha dados={versaoRd} compararCom={dadosAtuais.data} rotuloComparacao="da ficha atual (destacados em laranja)." />
            </Cartao>
          )}
        </>
      ) : (
        <Cartao titulo="Dados que vão para a ficha">
          <DadosDaFicha dados={versaoRd} />
        </Cartao>
      )}

      {/* Todas as colunas do RD */}
      <Cartao titulo="Todos os dados do RD Station">
        <div className="flex flex-col gap-3">
        {ORDEM_GRUPOS.map((grupo) => {
          const colunas = CHAVES_POR_GRUPO.get(grupo) ?? [];
          const preenchidas = colunas.filter((c) => {
            const v = dadosRd?.campos?.[c.chave as ChaveRd];
            return v !== null && v !== undefined;
          });
          const vazias = colunas.length - preenchidas.length;
          if (colunas.length === 0) return null;
          return (
            <details key={grupo} open={preenchidas.length > 0} className="rounded-sm border border-borda p-3">
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
          <details open className="rounded-sm border border-borda p-3">
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
        </div>
      </Cartao>
    </Pagina>
  );
}
