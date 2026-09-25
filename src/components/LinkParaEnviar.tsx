'use client';

import { useState } from 'react';
import { linkOutlookWeb } from '@/lib/equipe/mensagens';

const formatarValidade = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

/**
 * Link recém-gerado (aparece uma única vez): enviar pelo Outlook na web com a mensagem pronta,
 * copiar a mensagem ou copiar só o link.
 */
export function LinkParaEnviar({
  url,
  expiraEm,
  email,
  assunto,
  corpo,
  observacao,
}: {
  url: string;
  expiraEm: string;
  email: string | null;
  assunto: string;
  corpo: string;
  observacao?: string;
}) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (texto: string, qual: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(qual);
  };
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-laranja bg-laranja/5 p-3 text-sm">
      <p className="font-bold">Link gerado{email ? ` para ${email}` : ''} — envie agora, ele não aparece de novo.</p>
      <code className="break-all rounded-sm bg-white px-2 py-1 text-xs">{url}</code>
      <p className="text-xs text-texto/70">
        Vale até {formatarValidade(expiraEm)}.{observacao ? ` ${observacao}` : ''}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {email && (
          <a
            href={linkOutlookWeb(email, assunto, corpo)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center rounded-sm bg-laranja px-3 font-bold text-white no-underline hover:bg-laranja-escuro"
          >
            Enviar pelo Outlook
          </a>
        )}
        <button type="button" onClick={() => copiar(corpo, 'msg')} className="font-bold text-laranja underline underline-offset-4">
          {copiado === 'msg' ? 'Mensagem copiada ✓' : 'Copiar mensagem pronta'}
        </button>
        <button type="button" onClick={() => copiar(url, 'link')} className="font-bold text-laranja underline underline-offset-4">
          {copiado === 'link' ? 'Link copiado ✓' : 'Copiar só o link'}
        </button>
      </div>
      <p className="text-xs text-texto/70">
        {email
          ? '“Enviar pelo Outlook” abre o Outlook na web numa aba nova, com destinatário, assunto e texto prontos — é só clicar em Enviar. Se preferir outro canal, use “Copiar mensagem pronta”.'
          : 'Sem e-mail cadastrado: use “Copiar mensagem pronta” e envie pelo canal que preferir.'}
      </p>
    </div>
  );
}
