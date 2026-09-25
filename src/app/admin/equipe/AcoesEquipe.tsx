'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { LinkParaEnviar } from '@/components/LinkParaEnviar';
import { mensagemDoLink } from '@/lib/equipe/mensagens';

type Resposta<T> = { ok: boolean; data?: T; erro?: string };

async function chamar<T>(url: string, metodo: 'POST' | 'DELETE', corpo?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = (await r.json().catch(() => null)) as Resposta<T> | null;
  if (!r.ok || !json?.ok) throw new Error(json?.erro ?? `Erro ${r.status}`);
  return json.data as T;
}

interface LinkGerado {
  url: string;
  expiraEm: string;
  email: string;
  nome: string | null;
}

function LinkDeEquipe({ link, tipo, remetente }: { link: LinkGerado; tipo: 'convite' | 'nova_senha'; remetente: string }) {
  const { assunto, corpo } = mensagemDoLink({ tipo, url: link.url, expiraEm: link.expiraEm, nomeDestinatario: link.nome, remetente });
  return <LinkParaEnviar url={link.url} expiraEm={link.expiraEm} email={link.email} assunto={assunto} corpo={corpo} observacao="Só pode ser usado uma vez." />;
}

export function FormConvidar({ remetente }: { remetente: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<LinkGerado | null>(null);

  // onSubmit (e não <form action>): o React 19 limpa o formulário após uma action e, depois de um erro,
  // o envio seguinte não disparava. Assim os campos continuam preenchidos se o convite for recusado.
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const elemento = e.currentTarget;
    setErro(null);
    setGerado(null);
    iniciar(async () => {
      try {
        const email = String(form.get('email') ?? '').trim();
        const nome = String(form.get('nome') ?? '').trim() || null;
        const data = await chamar<{ url: string; expiraEm: string }>('/api/equipe/convites', 'POST', {
          email,
          nome: nome ?? undefined,
        });
        setGerado({ ...data, email, nome });
        elemento.reset();
        router.refresh();
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1">
          <span className="text-xs font-bold">E-mail</span>
          <input name="email" type="email" required className="h-10 rounded-sm bg-campo px-3 outline-none focus:ring-2 focus:ring-laranja" />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-xs font-bold">Nome (opcional)</span>
          <input name="nome" maxLength={120} className="h-10 rounded-sm bg-campo px-3 outline-none focus:ring-2 focus:ring-laranja" />
        </label>
        <button
          type="submit"
          disabled={pendente}
          className="h-10 rounded-sm bg-laranja px-4 text-sm font-bold text-white hover:bg-laranja-escuro disabled:opacity-60"
        >
          {pendente ? 'Gerando…' : 'Gerar link de convite'}
        </button>
      </form>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      {gerado && <LinkDeEquipe link={gerado} tipo="convite" remetente={remetente} />}
    </div>
  );
}

export function AcoesFuncionario({
  id,
  nome,
  email,
  ehVoce,
  remetente,
}: {
  id: string;
  nome: string;
  email: string | null;
  ehVoce: boolean;
  remetente: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<LinkGerado | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  const novaSenha = () =>
    iniciar(async () => {
      setErro(null);
      try {
        const data = await chamar<{ url: string; expiraEm: string }>(`/api/equipe/${id}/nova-senha`, 'POST');
        setGerado({ ...data, email: email ?? '', nome });
        router.refresh();
      } catch (e) {
        setErro((e as Error).message);
      }
    });

  const remover = () =>
    iniciar(async () => {
      setErro(null);
      try {
        await chamar(`/api/equipe/${id}`, 'DELETE');
        router.refresh();
      } catch (e) {
        setErro((e as Error).message);
        setConfirmarRemocao(false);
      }
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4 text-sm">
        <button type="button" onClick={novaSenha} disabled={pendente} className="underline underline-offset-4 hover:text-laranja">
          Link de nova senha
        </button>
        {!ehVoce &&
          (confirmarRemocao ? (
            <span className="flex gap-3">
              <span>Remover o acesso de {nome}?</span>
              <button type="button" onClick={remover} disabled={pendente} className="font-bold text-red-700 underline underline-offset-4">
                Sim, remover
              </button>
              <button type="button" onClick={() => setConfirmarRemocao(false)} className="underline underline-offset-4">
                Cancelar
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmarRemocao(true)} className="text-red-700 underline underline-offset-4">
              Remover acesso
            </button>
          ))}
      </div>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      {gerado && <LinkDeEquipe link={gerado} tipo="nova_senha" remetente={remetente} />}
    </div>
  );
}

export function BotaoRevogarConvite({ id }: { id: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          await chamar(`/api/equipe/convites/${id}`, 'DELETE').catch(() => null);
          router.refresh();
        })
      }
      className="text-sm underline underline-offset-4 hover:text-laranja"
    >
      Cancelar link
    </button>
  );
}
