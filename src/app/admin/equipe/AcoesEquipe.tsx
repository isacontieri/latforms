'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

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

/** Mostra o link gerado (uma única vez) com botões de copiar o link e uma mensagem pronta. */
function LinkGerado({ url, expiraEm, mensagem }: { url: string; expiraEm: string; mensagem: string }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (texto: string, qual: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(qual);
  };
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-laranja bg-laranja/5 p-3 text-sm">
      <p className="font-bold">Link gerado — copie agora, ele não aparece de novo.</p>
      <code className="break-all rounded-sm bg-white px-2 py-1 text-xs">{url}</code>
      <p className="text-xs text-texto/70">Vale até {formatarValidade(expiraEm)} e só pode ser usado uma vez.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => copiar(url, 'link')} className="font-bold text-laranja underline underline-offset-4">
          {copiado === 'link' ? 'Link copiado ✓' : 'Copiar link'}
        </button>
        <button type="button" onClick={() => copiar(`${mensagem}\n${url}`, 'msg')} className="font-bold text-laranja underline underline-offset-4">
          {copiado === 'msg' ? 'Mensagem copiada ✓' : 'Copiar mensagem pronta'}
        </button>
      </div>
    </div>
  );
}

export function FormConvidar() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<{ url: string; expiraEm: string } | null>(null);

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
        const data = await chamar<{ url: string; expiraEm: string }>('/api/equipe/convites', 'POST', {
          email: String(form.get('email') ?? ''),
          nome: String(form.get('nome') ?? '') || undefined,
        });
        setGerado(data);
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
      {gerado && (
        <LinkGerado
          {...gerado}
          mensagem="Olá! Este é o seu convite para acessar o LatForms, o sistema de fichas da Latitudes. Abra o link, preencha seu nome e crie sua senha:"
        />
      )}
    </div>
  );
}

export function AcoesFuncionario({ id, nome, ehVoce }: { id: string; nome: string; ehVoce: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<{ url: string; expiraEm: string } | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  const novaSenha = () =>
    iniciar(async () => {
      setErro(null);
      try {
        setGerado(await chamar<{ url: string; expiraEm: string }>(`/api/equipe/${id}/nova-senha`, 'POST'));
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
      {gerado && (
        <LinkGerado
          {...gerado}
          mensagem="Olá! Este é o link para você definir uma nova senha no LatForms (vale por 24 horas e uma única vez):"
        />
      )}
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
