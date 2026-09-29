import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Cartao, CartaoResumo } from '@/components/ui/Cartao';
import { Pagina } from '@/components/ui/Pagina';
import { verificarConsultora } from '@/lib/auth';
import { camposAlterados } from '@/lib/ficha/diff';
import { percentualPreenchido } from '@/lib/ficha/layout';
import { criarClienteServidor } from '@/lib/supabase/server';
import { FichasAoVivo, type LinhaFicha } from './FichasAoVivo';

type Dados = Record<string, string | null>;

export const metadata: Metadata = { title: 'Visão geral — LatForms' };

const numero = new Intl.NumberFormat('pt-BR');

export default async function PaginaVisaoGeral() {
  const auth = await verificarConsultora();
  if (!auth.ok) redirect('/login');

  const supabase = await criarClienteServidor();
  const [{ data: fichas }, { count: nClientes }, { count: nAprovadas }] = await Promise.all([
    supabase
      .from('fichas')
      .select('id, status, dados_atuais, dados_originais, dados_revisados, cliente_visto_em, atualizado_em, clientes(nome)')
      .in('status', ['enviada', 'aberta', 'em_preenchimento', 'concluida'])
      .order('atualizado_em', { ascending: false })
      .limit(100),
    supabase.from('clientes').select('*', { count: 'exact', head: true }),
    supabase.from('fichas').select('*', { count: 'exact', head: true }).eq('status', 'aprovada'),
  ]);
  const linhas: LinhaFicha[] = (fichas ?? []).map((f) => ({
    id: f.id,
    cliente: f.clientes?.nome ?? '—',
    status: f.status,
    percentual: percentualPreenchido(f.dados_atuais as Dados),
    alterados: camposAlterados(f.dados_atuais as Dados, (f.dados_revisados ?? f.dados_originais) as Dados).size,
    vistoEm: f.cliente_visto_em,
    atualizadoEm: f.atualizado_em,
  }));
  const comClientes = linhas.filter((l) => l.status !== 'concluida').length;
  const concluidas = linhas.filter((l) => l.status === 'concluida').length;
  const aRevisar = linhas.filter((l) => l.alterados > 0).length;

  return (
    <Pagina secao="Início" titulo="Visão geral">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoResumo rotulo="Com os clientes" valor={numero.format(comClientes)} detalhe="link enviado ou em preenchimento" />
        <CartaoResumo
          rotulo="Fichas a revisar"
          valor={numero.format(aRevisar)}
          detalhe={aRevisar ? 'com alterações novas do cliente' : 'nada novo'}
          alerta={aRevisar > 0}
        />
        <CartaoResumo rotulo="Concluídas pelo cliente" valor={numero.format(concluidas)} detalhe="exportar CSV →" href="/api/exportar?status=concluida" />
        <CartaoResumo
          rotulo="Clientes"
          valor={numero.format(nClientes ?? 0)}
          detalhe={`${numero.format(nAprovadas ?? 0)} aprovada(s) · ver clientes →`}
          href="/admin/clientes"
        />
      </div>

      <Cartao
        titulo="Fichas em andamento"
        acoes={<span className="text-xs text-texto/50">Atualiza sozinho. Clique numa ficha para acompanhar ao vivo.</span>}
        semPadding
      >
        <FichasAoVivo linhas={linhas} />
      </Cartao>
    </Pagina>
  );
}
