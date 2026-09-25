import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { verificarFuncionario } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { AcoesFuncionario, BotaoRevogarConvite, FormConvidar } from './AcoesEquipe';

export const metadata: Metadata = { title: 'Equipe — LatForms' };

const formatarData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

export default async function PaginaEquipe() {
  const auth = await verificarFuncionario();
  if (!auth.ok) redirect('/login');

  // convites_equipe só é acessível pelo servidor (secret key); a checagem de funcionário foi feita acima
  const admin = criarClienteAdmin();
  const [{ data: equipe }, { data: pendentes }] = await Promise.all([
    admin.from('funcionarios').select('id, nome, email, criado_em').order('nome'),
    admin
      .from('convites_equipe')
      .select('id, tipo, email, nome, expira_em, criado_em')
      .is('usado_em', null)
      .is('revogado_em', null)
      .gt('expira_em', new Date().toISOString())
      .order('criado_em', { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-bold text-laranja">Equipe</h1>
        <p className="text-sm">
          Quem está aqui pode entrar no LatForms. Para dar acesso a alguém, gere um link de convite e envie pelo Outlook (o
          botão abre um e-mail já escrito) ou pelo canal que preferir: a pessoa abre o link, informa o
          nome e cria a senha.
        </p>
        <FormConvidar remetente={auth.funcionario.nome} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-laranja">Com acesso ({equipe?.length ?? 0})</h2>
        <ul className="flex flex-col divide-y divide-campo rounded-sm border border-campo">
          {(equipe ?? []).map((f) => (
            <li key={f.id} className="flex flex-col gap-2 p-3">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-bold">{f.nome}</span>
                <span className="text-sm text-texto/70">{f.email ?? '—'}</span>
                {f.id === auth.funcionario.id && <span className="text-xs text-laranja-escuro">(você)</span>}
                <span className="text-xs text-texto/50">desde {formatarData.format(new Date(f.criado_em))}</span>
              </div>
              <AcoesFuncionario
                id={f.id}
                nome={f.nome}
                email={f.email}
                ehVoce={f.id === auth.funcionario.id}
                remetente={auth.funcionario.nome}
              />
            </li>
          ))}
        </ul>
      </section>

      {pendentes && pendentes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-laranja">Links pendentes ({pendentes.length})</h2>
          <ul className="flex flex-col divide-y divide-campo rounded-sm border border-campo">
            {pendentes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                <span>
                  <span className="font-bold">{c.tipo === 'convite' ? 'Convite' : 'Nova senha'}</span> · {c.nome ? `${c.nome} · ` : ''}
                  {c.email} · vale até {formatarData.format(new Date(c.expira_em))}
                </span>
                <BotaoRevogarConvite id={c.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
