'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { LinkParaEnviar } from '@/components/LinkParaEnviar';
import { mensagemLinkCliente } from '@/lib/equipe/mensagens';

const formatar = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

export interface LinkAtivo {
  expiraEm: string;
  usos: number;
  ultimoAcessoEm: string | null;
}

/** Link com token para o cliente: gerar (revoga o anterior), enviar pelo Outlook e revogar. */
export function LinkDoCliente({
  fichaId,
  nomeCliente,
  emailCliente,
  remetente,
  ativo,
  podeGerar,
}: {
  fichaId: string;
  nomeCliente: string;
  emailCliente: string | null;
  remetente: string;
  ativo: LinkAtivo | null;
  podeGerar: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<{ url: string; expiraEm: string } | null>(null);
  const [confirmarRevogar, setConfirmarRevogar] = useState(false);

  const chamar = (metodo: 'POST' | 'DELETE') =>
    iniciar(async () => {
      setErro(null);
      const r = await fetch(`/api/fichas/${fichaId}/link`, { method: metodo });
      const json = (await r.json().catch(() => null)) as { ok: boolean; data?: { url: string; expiraEm: string }; erro?: string } | null;
      if (!r.ok || !json?.ok) {
        setErro(json?.erro ?? `Erro ${r.status}`);
        return;
      }
      if (metodo === 'POST' && json.data) setGerado(json.data);
      if (metodo === 'DELETE') setGerado(null);
      setConfirmarRevogar(false);
      router.refresh();
    });

  const mensagem = gerado ? mensagemLinkCliente({ url: gerado.url, expiraEm: gerado.expiraEm, nomeCliente, remetente }) : null;

  return (
    <div className="flex flex-col gap-2 border-t border-campo pt-3">
      <span className="font-bold">Link para o cliente</span>
      {ativo ? (
        <p>
          Ativo até {formatar(ativo.expiraEm)} ·{' '}
          {ativo.usos === 0 ? 'ainda não aberto' : `aberto ${ativo.usos} vez(es), último acesso em ${formatar(ativo.ultimoAcessoEm!)}`}
        </p>
      ) : (
        <p className="text-texto/70">Nenhum link ativo.</p>
      )}

      {podeGerar && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={() => chamar('POST')}
            disabled={pendente}
            className="h-9 rounded-sm bg-laranja px-3 text-sm font-bold text-white hover:bg-laranja-escuro disabled:opacity-60"
          >
            {pendente ? 'Gerando…' : ativo ? 'Gerar novo link' : 'Gerar link para o cliente'}
          </button>
          {ativo &&
            (confirmarRevogar ? (
              <span className="flex flex-wrap gap-3">
                <span>O link atual deixa de funcionar. Confirmar?</span>
                <button type="button" onClick={() => chamar('DELETE')} className="font-bold text-red-700 underline underline-offset-4">
                  Sim, revogar
                </button>
                <button type="button" onClick={() => setConfirmarRevogar(false)} className="underline underline-offset-4">
                  Cancelar
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmarRevogar(true)} className="text-red-700 underline underline-offset-4">
                Revogar link
              </button>
            ))}
        </div>
      )}
      {ativo && podeGerar && !gerado && (
        <p className="text-xs text-texto/60">O link só aparece na hora em que é gerado. Para enviar de novo, gere um novo (o anterior deixa de funcionar).</p>
      )}
      {erro && <p role="alert" className="text-red-700">{erro}</p>}
      {gerado && mensagem && (
        <LinkParaEnviar
          url={gerado.url}
          expiraEm={gerado.expiraEm}
          email={emailCliente}
          assunto={mensagem.assunto}
          corpo={mensagem.corpo}
          observacao="Gerar outro link faz este parar de funcionar."
        />
      )}
    </div>
  );
}
