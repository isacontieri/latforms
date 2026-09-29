import type { Database } from '@/lib/supabase/database.types';

export type StatusFicha = Database['public']['Enums']['status_ficha'];

export type EventoFicha = 'gerar_link' | 'primeiro_acesso' | 'concluir' | 'aprovar' | 'reabrir' | 'cancelar';

export const ROTULO_STATUS: Record<StatusFicha, string> = {
  gerada: 'Gerada',
  enviada: 'Link enviado',
  aberta: 'Aberta pelo cliente',
  em_preenchimento: 'Em preenchimento',
  concluida: 'Concluída pelo cliente',
  aprovada: 'Aprovada',
  cancelada: 'Cancelada',
};

/**
 * Enquanto o cliente não editou nenhum campo, a ficha acompanha o RD (reimportação e botão).
 * A primeira edição (RPC atualizar_campo) muda para "em_preenchimento" e a ficha deixa de ser tocada pelo RD.
 */
export function aceitaDadosDoRd(status: StatusFicha): boolean {
  return status === 'gerada' || status === 'enviada' || status === 'aberta';
}

/** O cliente pode editar pelo link (o SQL também recusa concluída/aprovada/cancelada). */
export function editavelPeloCliente(status: StatusFicha): boolean {
  return status === 'enviada' || status === 'aberta' || status === 'em_preenchimento';
}

/** Próximo status para um evento, ou `null` se a transição não é permitida. A edição de campo fica no SQL. */
export function proximoStatus(atual: StatusFicha, evento: EventoFicha): StatusFicha | null {
  switch (evento) {
    case 'gerar_link':
      if (atual === 'gerada') return 'enviada';
      return atual === 'cancelada' ? null : atual;
    case 'primeiro_acesso':
      // marcado no 1º sinal de presença do navegador (pré-visualização de link não roda JavaScript)
      return atual === 'enviada' ? 'aberta' : atual === 'cancelada' ? null : atual;
    case 'concluir':
      return editavelPeloCliente(atual) ? 'concluida' : null;
    case 'aprovar':
      return atual === 'concluida' ? 'aprovada' : null;
    case 'reabrir':
      return atual === 'concluida' || atual === 'aprovada' ? 'em_preenchimento' : null;
    case 'cancelar':
      return atual === 'aprovada' || atual === 'cancelada' ? null : 'cancelada';
  }
}
