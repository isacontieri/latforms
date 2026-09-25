'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { linkMailto, linkOutlookWeb, mensagemDoLink } from '@/lib/equipe/mensagens';

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

const formatarValidade = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

interface LinkParaEnviar {
  url: string;
  expiraEm: string;
  email: string;
  nome: string | null;
}

/**
 * Mostra o link gerado (uma única vez) com: enviar por e-mail (abre o Outlook/app de e-mail de quem convida,
 * já com destinatário, assunto e texto), copiar a mensagem pronta e copiar só o link.
 */
function LinkGerado({ link, tipo, remetente }: { link: LinkParaEnviar; tipo: 'convite' | 'nova_senha'; remetente: string }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const { assunto, corpo } = mensagemDoLink({ tipo, url: link.url, expiraEm: link.expiraEm, nomeDestinatario: link.nome, remetente });
  const copiar = async (texto: string, qual: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(qual);
  };
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-laranja bg-laranja/5 p-3 text-sm">
      <p className="font-bold">Link gerado para {link.email} — envie agora, ele não aparece de novo.</p>
      <code className="break-all rounded-sm bg-white px-2 py-1 text-xs">{link.url}</code>
      <p className="text-xs text-texto/70">Vale até {formatarValidade(link.expiraEm)} e só pode ser usado uma vez.</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={linkOutlookWeb(link.email, assunto, corpo)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center rounded-sm bg-laranja px-3 font-bold text-white no-underline hover:bg-laranja-escuro"
        >
          Enviar pelo Outlook
        </a>
        <a href={linkMailto(link.email, assunto, corpo)} className="font-bold text-laranja underline underline-offset-4">
          Abrir no programa de e-mail
        </a>
        <button type="button" onClick={() => copiar(corpo, 'msg')} className="font-bold text-laranja underline underline-offset-4">
          {copiado === 'msg' ? 'Mensagem copiada ✓' : 'Copiar mensagem pronta'}
        </button>
        <button type="button" onClick={() => copiar(link.url, 'link')} className="font-bold text-laranja underline underline-offset-4">
          {copiado === 'link' ? 'Link copiado ✓' : 'Copiar só o link'}
        </button>
      </div>
      <p className="text-xs text-texto/70">
        “Enviar pelo Outlook” abre o Outlook na web numa aba nova, com destinatário, assunto e texto prontos — é só clicar
        em Enviar (precisa estar logada no Outlook/Microsoft 365 da Latitudes). “Abrir no programa de e-mail” usa o
        aplicativo instalado no computador, se houver um definido como padrão. Se nenhum abrir, use “Copiar mensagem
        pronta”.
      </p>
    </div>
  );
}

export function FormConvidar({ remetente }: { remetente: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<LinkParaEnviar | null>(null);

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
      {gerado && <LinkGerado link={gerado} tipo="convite" remetente={remetente} />}
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
  const [gerado, setGerado] = useState<LinkParaEnviar | null>(null);
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
      {gerado && <LinkGerado link={gerado} tipo="nova_senha" remetente={remetente} />}
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
