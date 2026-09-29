import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Cartao } from '@/components/ui/Cartao';
import { Pagina } from '@/components/ui/Pagina';
import { verificarConsultora } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { AcoesFuncionario, BotaoRevogarConvite, FormConvidar } from './AcoesEquipe';

export const metadata: Metadata = { title: 'Equipe — LatForms' };

const formatarData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

export default async function PaginaEquipe() {
  const auth = await verificarConsultora();
  if (!auth.ok) redirect('/login');

  // convites_equipe só é acessível pelo servidor (secret key); a checagem de consultora foi feita acima
  const admin = criarClienteAdmin();
  const [{ data: equipe }, { data: pendentes }] = await Promise.all([
    admin.from('consultoras').select('id, nome, email, criado_em').order('nome'),
    admin
      .from('convites_equipe')
      .select('id, tipo, email, nome, expira_em, criado_em')
      .is('usado_em', null)
      .is('revogado_em', null)
      .gt('expira_em', new Date().toISOString())
      .order('criado_em', { ascending: false }),
  ]);

  return (
    <Pagina
      secao="Administração"
      titulo="Equipe"
      descricao="Quem está aqui pode entrar no LatForms. Para dar acesso a alguém, gere um link de convite e envie pelo Outlook ou pelo canal que preferir: a pessoa abre o link, informa o nome e cria a senha."
    >
      <Cartao titulo="Convidar alguém">
        <FormConvidar remetente={auth.consultora.nome} />
      </Cartao>

      <Cartao titulo={`Com acesso (${equipe?.length ?? 0})`} semPadding>
        <ul className="flex flex-col divide-y divide-borda">
          {(equipe ?? []).map((f) => (
            <li key={f.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-bold">{f.nome}</span>
                <span className="text-sm text-texto/70">{f.email ?? '—'}</span>
                {f.id === auth.consultora.id && <span className="text-xs text-laranja-escuro">(você)</span>}
                <span className="text-xs text-texto/50">desde {formatarData.format(new Date(f.criado_em))}</span>
              </div>
              <AcoesFuncionario
                id={f.id}
                nome={f.nome}
                email={f.email}
                ehVoce={f.id === auth.consultora.id}
                remetente={auth.consultora.nome}
              />
            </li>
          ))}
        </ul>
      </Cartao>

      {pendentes && pendentes.length > 0 && (
        <Cartao titulo={`Links pendentes (${pendentes.length})`} semPadding>
          <ul className="flex flex-col divide-y divide-borda">
            {pendentes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-bold">{c.tipo === 'convite' ? 'Convite' : 'Nova senha'}</span> · {c.nome ? `${c.nome} · ` : ''}
                  {c.email} · vale até {formatarData.format(new Date(c.expira_em))}
                </span>
                <BotaoRevogarConvite id={c.id} />
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </Pagina>
  );
}
