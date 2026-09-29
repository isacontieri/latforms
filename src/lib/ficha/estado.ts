import type { StatusFicha } from './status';

/** Uma linha do histórico campo a campo (ficha_edicoes). */
export interface Edicao {
  id: number;
  campo: string;
  anterior: string | null;
  novo: string | null;
  origem: 'cliente' | 'consultora';
  em: string;
}

/** Estado da ficha no painel da consultora — sempre recarregável do banco (fonte da verdade). */
export interface EstadoFicha {
  id: string;
  status: StatusFicha;
  atuais: Record<string, string | null>;
  originais: Record<string, string | null>;
  campoEmFoco: string | null;
  clienteVistoEm: string | null;
  concluidaEm: string | null;
  edicoes: Edicao[];
}

export const LIMITE_EDICOES = 200;
/** Cliente "online" se o último sinal do navegador tem menos de 60 s. */
export const ONLINE_MS = 60_000;

export function clienteOnline(vistoEm: string | null, agora = Date.now()): boolean {
  return vistoEm !== null && agora - new Date(vistoEm).getTime() < ONLINE_MS;
}

const texto = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export function linhaParaEdicao(l: { id: number; campo: string; valor_anterior: unknown; valor_novo: unknown; origem: string; criado_em: string }): Edicao {
  return {
    id: l.id,
    campo: l.campo,
    anterior: texto(l.valor_anterior),
    novo: texto(l.valor_novo),
    origem: l.origem === 'consultora' ? 'consultora' : 'cliente',
    em: l.criado_em,
  };
}
