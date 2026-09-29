import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Cartao, TABELA } from '@/components/ui/Cartao';
import { Pagina } from '@/components/ui/Pagina';
import { SeloStatus } from '@/components/ui/SeloStatus';
import { verificarConsultora } from '@/lib/auth';
import { criarClienteServidor } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Clientes — LatForms' };

const formatarData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

export default async function PaginaClientes() {
  const auth = await verificarConsultora();
  if (!auth.ok) redirect('/login');

  const supabase = await criarClienteServidor();
  const { data: clientes, count, error } = await supabase
    .from('clientes')
    .select('id, nome, email, atualizado_em, fichas(id, status)', { count: 'exact' })
    .order('atualizado_em', { ascending: false })
    .limit(100);

  return (
    <Pagina
      secao="Fichas"
      titulo={<>Clientes {count != null && <span className="text-texto/40">({count})</span>}</>}
      acoes={
        <Link href="/admin/importar" className="flex h-9 items-center rounded-sm bg-laranja px-4 text-sm font-bold text-white hover:bg-laranja-escuro">
          Importar CSV
        </Link>
      }
    >
      {error && <p className="text-sm text-red-700">Não foi possível carregar os clientes.</p>}
      <Cartao titulo="Clientes importados do RD" semPadding>
        {clientes && clientes.length === 0 ? (
          <p className="p-4 text-sm">Nenhum cliente ainda. Comece importando o CSV exportado do RD Station.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={`${TABELA.tabela} min-w-[40rem]`}>
              <thead>
                <tr>
                  <th className={TABELA.th}>Nome</th>
                  <th className={TABELA.th}>E-mail</th>
                  <th className={TABELA.th}>Ficha</th>
                  <th className={TABELA.th}>Atualizado em</th>
                </tr>
              </thead>
              <tbody>
                {(clientes ?? []).map((c) => {
                  const ficha = c.fichas.find((f) => f.status !== 'cancelada');
                  return (
                    <tr key={c.id} className={TABELA.tr}>
                      <td className={TABELA.td}>
                        <Link href={`/admin/clientes/${c.id}`} className="font-bold hover:text-laranja hover:underline">
                          {c.nome}
                        </Link>
                      </td>
                      <td className={`${TABELA.td} text-texto/70`}>{c.email ?? '—'}</td>
                      <td className={TABELA.td}>
                        {ficha ? <SeloStatus status={ficha.status} curto /> : <span className="text-xs text-texto/50">sem ficha</span>}
                      </td>
                      <td className={TABELA.data}>{formatarData.format(new Date(c.atualizado_em))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {count != null && clientes && count > clientes.length && (
              <p className="px-4 py-3 text-xs text-texto/60">Mostrando os {clientes.length} atualizados mais recentemente.</p>
            )}
          </div>
        )}
      </Cartao>
    </Pagina>
  );
}
