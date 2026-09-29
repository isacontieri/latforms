import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { verificarConsultora } from '@/lib/auth';
import { carregarEstadoFicha } from '@/lib/ficha/estado-servidor';
import { proximoStatus } from '@/lib/ficha/status';
import { criarClienteServidor } from '@/lib/supabase/server';
import { LinkDoCliente, type LinkAtivo } from '../../clientes/[id]/LinkDoCliente';
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/admin/clientes/${cliente.id}`} className="text-sm underline underline-offset-4 hover:text-laranja">
          ← {cliente.nome}
        </Link>
        <h1 className="text-2xl font-bold">Ficha de {cliente.nome}</h1>
      </div>
      <FichaAoVivo
        inicial={estado}
        rodape={
          <LinkDoCliente
            key="link"
            fichaId={estado.id}
            nomeCliente={cliente.nome}
            emailCliente={cliente.email}
            remetente={auth.consultora.nome}
            ativo={linkAtivo}
            podeGerar={proximoStatus(estado.status, 'gerar_link') !== null}
          />
        }
      />
    </div>
  );
}
