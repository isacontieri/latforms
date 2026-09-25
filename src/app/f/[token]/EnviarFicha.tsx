'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { criarClienteNavegador } from '@/lib/supabase/client';

const LIMITE = 5 * 1024 * 1024;

type Etapa = { tipo: 'parado' } | { tipo: 'enviando'; texto: string } | { tipo: 'ok' } | { tipo: 'erro'; texto: string };

async function postar<T>(url: string, corpo?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = (await r.json().catch(() => null)) as { ok: boolean; data?: T; erro?: string } | null;
  if (!r.ok || !json?.ok) throw new Error(json?.erro ?? 'Não foi possível enviar agora. Tente de novo.');
  return json.data as T;
}

/**
 * Envio do PDF preenchido: pede uma URL assinada, manda o arquivo direto ao Supabase Storage (sem passar
 * pela Vercel) e avisa o servidor, que valida o arquivo. A checagem aqui é só para feedback rápido.
 */
export function EnviarFicha({ token, rotulo }: { token: string; rotulo: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'parado' });

  async function enviar(arquivo: File) {
    if (arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) {
      setEtapa({ tipo: 'erro', texto: 'Escolha o arquivo PDF da ficha (termina em .pdf).' });
      return;
    }
    if (arquivo.size > LIMITE) {
      setEtapa({ tipo: 'erro', texto: 'O arquivo passa de 5 MB. Envie o PDF da ficha que você baixou aqui.' });
      return;
    }
    try {
      setEtapa({ tipo: 'enviando', texto: 'Enviando o arquivo…' });
      const { path, token: tokenUpload } = await postar<{ path: string; token: string }>(`/api/f/${token}/upload-url`);
      const { error } = await criarClienteNavegador()
        .storage.from('fichas-respondidas')
        .uploadToSignedUrl(path, tokenUpload, arquivo, { contentType: 'application/pdf' });
      if (error) throw new Error('O envio do arquivo falhou. Verifique sua conexão e tente de novo.');

      setEtapa({ tipo: 'enviando', texto: 'Conferindo a ficha…' });
      await postar(`/api/f/${token}/confirmar`, { path });
      setEtapa({ tipo: 'ok' });
      router.refresh();
    } catch (e) {
      setEtapa({ tipo: 'erro', texto: (e as Error).message });
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  const enviando = etapa.tipo === 'enviando';
  return (
    <div className="flex flex-col gap-3">
      <label
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-sm border-2 border-dashed border-campo px-4 py-8 text-center hover:border-laranja ${
          enviando ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <span className="font-bold">{enviando ? etapa.texto : rotulo}</span>
        <span className="text-xs text-texto/70">Arquivo PDF da ficha, até 5 MB</span>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={enviando}
          onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])}
        />
      </label>
      <div aria-live="polite">
        {etapa.tipo === 'ok' && (
          <p className="rounded-sm border border-green-700/30 bg-green-50 p-3 text-sm text-green-800">
            Recebemos sua ficha. Obrigado! A equipe Latitudes vai conferir as informações.
          </p>
        )}
        {etapa.tipo === 'erro' && (
          <p role="alert" className="rounded-sm border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {etapa.texto}
          </p>
        )}
      </div>
    </div>
  );
}
