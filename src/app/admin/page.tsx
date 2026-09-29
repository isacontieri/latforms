import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { verificarConsultora } from '@/lib/auth';
import { camposAlterados } from '@/lib/ficha/diff';
import { percentualPreenchido } from '@/lib/ficha/layout';
import { criarClienteServidor } from '@/lib/supabase/server';
import { FichasAoVivo, type LinhaFicha } from './FichasAoVivo';

type Dados = Record<string, string | null>;

export const metadata: Metadata = { title: 'Clientes — LatForms' };

const formatarData = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

export default async function PaginaAdmin() {
  const auth = await verificarConsultora();
  if (!auth.ok) redirect('/login');

  const supabase = await criarClienteServidor();
  const { data: clientes, count, error } = await supabase
    .from('clientes')
    .select('id, nome, email, atualizado_em, fichas(count)', { count: 'exact' })
    .order('atualizado_em', { ascending: false })
    .limit(100);
  const { data: fichas } = await supabase
    .from('fichas')
    .select('id, status, dados_atuais, dados_originais, dados_revisados, cliente_visto_em, atualizado_em, clientes(nome)')
    .in('status', ['enviada', 'aberta', 'em_preenchimento', 'concluida'])
    .order('atualizado_em', { ascending: false })
    .limit(100);
  const linhas: LinhaFicha[] = (fichas ?? []).map((f) => ({
    id: f.id,
    cliente: f.clientes?.nome ?? '—',
    status: f.status,
    percentual: percentualPreenchido(f.dados_atuais as Dados),
    alterados: camposAlterados(f.dados_atuais as Dados, (f.dados_revisados ?? f.dados_originais) as Dados).size,
    vistoEm: f.cliente_visto_em,
    atualizadoEm: f.atualizado_em,
  }));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-laranja">Fichas em andamento</h1>
        <div className="flex flex-wrap gap-3 text-sm">
          <a href="/api/exportar?status=concluida" className="font-bold text-laranja underline underline-offset-4">
            Exportar concluídas (CSV)
          </a>
          <a href="/api/exportar?status=aprovada" className="font-bold text-laranja underline underline-offset-4">
            Exportar aprovadas (CSV)
          </a>
        </div>
      </div>
      <FichasAoVivo linhas={linhas} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="mt-4 text-xl font-bold text-laranja">Clientes {count != null && <span className="text-texto/60">({count})</span>}</h2>
        <Link href="/admin/importar" className="flex h-10 items-center rounded-sm bg-laranja px-4 text-sm font-bold text-white hover:bg-laranja-escuro">
          Importar CSV
        </Link>
      </div>

      {error && <p className="text-sm text-red-700">Não foi possível carregar os clientes.</p>}

      {clientes && clientes.length === 0 && (
        <p className="text-sm">Nenhum cliente ainda. Comece importando o CSV exportado do RD Station.</p>
      )}

      {clientes && clientes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-campo text-xs">
              <tr>
                <th className="py-2 pr-3 font-bold">Nome</th>
                <th className="py-2 pr-3 font-bold">E-mail</th>
                <th className="py-2 pr-3 font-bold">Fichas</th>
                <th className="py-2 font-bold">Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-campo/60">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/clientes/${c.id}`} className="font-bold hover:text-laranja hover:underline">
                      {c.nome}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{c.email ?? '—'}</td>
                  <td className="py-2 pr-3">{c.fichas[0]?.count ?? 0}</td>
                  <td className="py-2">{formatarData.format(new Date(c.atualizado_em))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {count != null && count > clientes.length && (
            <p className="mt-2 text-xs text-texto/60">Mostrando os {clientes.length} atualizados mais recentemente.</p>
          )}
        </div>
      )}
    </section>
  );
}
