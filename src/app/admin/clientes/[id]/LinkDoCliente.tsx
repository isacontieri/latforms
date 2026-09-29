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
  reabre = false,
}: {
  fichaId: string;
  nomeCliente: string;
  emailCliente: string | null;
  remetente: string;
  ativo: LinkAtivo | null;
  podeGerar: boolean;
  /** ficha concluída/aprovada: gerar um link novo devolve a ficha ao cliente para editar */
  reabre?: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<{ url: string; expiraEm: string; reaberta?: boolean } | null>(null);
  const [confirmarRevogar, setConfirmarRevogar] = useState(false);

  const chamar = (metodo: 'POST' | 'DELETE') =>
    iniciar(async () => {
      setErro(null);
      const r = await fetch(`/api/fichas/${fichaId}/link`, { method: metodo });
      const json = (await r.json().catch(() => null)) as { ok: boolean; data?: { url: string; expiraEm: string; reaberta?: boolean }; erro?: string } | null;
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
    <div className="flex flex-col gap-2 border-t border-borda pt-3">
      <h2 className="text-xs font-bold tracking-wide text-texto/60 uppercase">Link do cliente</h2>
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
            className={`h-9 rounded-sm px-3 text-sm font-bold disabled:opacity-60 ${
              ativo ? 'bg-campo hover:bg-campo/70' : 'bg-laranja text-white hover:bg-laranja-escuro'
            }`}
          >
            {pendente ? 'Gerando…' : reabre ? 'Gerar novo link e reabrir' : ativo ? 'Gerar novo link' : 'Gerar link para o cliente'}
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
      {reabre && podeGerar && !gerado && (
        <p className="text-xs text-texto/70">
          A ficha está concluída e o cliente não consegue mais editar. Gerar um novo link <strong>reabre a ficha</strong> para ele
          alterar pelo link novo.
        </p>
      )}
      {gerado?.reaberta && (
        <p className="rounded-sm border border-green-700/30 bg-green-50 p-2 text-xs text-green-800" role="status">
          Ficha reaberta: o cliente já pode editar pelo link novo.
        </p>
      )}
      {ativo && podeGerar && !gerado && !reabre && (
        <p className="text-xs text-texto/60">Para reenviar, gere um novo link (o anterior para de funcionar).</p>
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
