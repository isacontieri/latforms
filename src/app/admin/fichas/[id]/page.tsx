import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Pagina } from '@/components/ui/Pagina';
import { verificarConsultora } from '@/lib/auth';
import { carregarEstadoFicha } from '@/lib/ficha/estado-servidor';
import { criarClienteServidor } from '@/lib/supabase/server';
import type { LinkAtivo } from '../../clientes/[id]/LinkDoCliente';
import { FichaAoVivo } from './FichaAoVivo';

export const metadata: Metadata = { title: 'Ficha ao vivo — LatForms' };
export const dynamic = 'force-dynamic';

export default async function PaginaFichaAoVivo({ params }: PageProps<'/admin/fichas/[id]'>) {
  const auth = await verificarConsultora();
  if (!auth.ok) redirect('/login');

  const { id } = await params;
  const supabase = await criarClienteServidor();
  const [estado, { data: extra }] = await Promise.all([
    carregarEstadoFicha(supabase, id),
    supabase
      .from('fichas')
      .select('clientes(id, nome, email), tokens_acesso(expira_em, revogado_em, usos, ultimo_acesso_em)')
      .eq('id', id)
      .maybeSingle(),
  ]);
  if (!estado || !extra?.clientes) notFound();

  const cliente = extra.clientes;
  const agora = new Date();
  const token = extra.tokens_acesso.find((t) => !t.revogado_em && new Date(t.expira_em) > agora) ?? null;
  const linkAtivo: LinkAtivo | null = token ? { expiraEm: token.expira_em, usos: token.usos, ultimoAcessoEm: token.ultimo_acesso_em } : null;

  return (
    <Pagina secao="Clientes" voltar={{ href: `/admin/clientes/${cliente.id}`, rotulo: 'Ficha ao vivo' }} titulo={cliente.nome}>
      <FichaAoVivo
        inicial={estado}
        link={{ nomeCliente: cliente.nome, emailCliente: cliente.email, remetente: auth.consultora.nome, ativo: linkAtivo }}
      />
    </Pagina>
  );
}
