import type { Database } from '@/lib/supabase/database.types';

export type StatusFicha = Database['public']['Enums']['status_ficha'];

export type EventoFicha =
  | 'gerar_link'
  | 'baixar_pdf'
  | 'upload_valido'
  | 'pedir_correcao'
  | 'aprovar'
  | 'cancelar';

export const ROTULO_STATUS: Record<StatusFicha, string> = {
  gerada: 'Gerada',
  enviada: 'Link enviado',
  aberta: 'Aberta pelo cliente',
  respondida: 'Respondida',
  correcao_solicitada: 'Correção solicitada',
  aprovada: 'Aprovada',
  cancelada: 'Cancelada',
};

const COM_LINK: readonly StatusFicha[] = ['enviada', 'aberta', 'respondida', 'correcao_solicitada'];

/**
 * Próximo status para um evento, ou `null` se a transição não é permitida.
 * Tabela: skill ficha-cadastro-latitudes §8.
 */
export function proximoStatus(atual: StatusFicha, evento: EventoFicha): StatusFicha | null {
  switch (evento) {
    case 'gerar_link':
      if (atual === 'gerada') return 'enviada';
      return COM_LINK.includes(atual) ? atual : null;
    case 'baixar_pdf':
      // abrir a página não conta (pré-visualização de link); só o download marca "aberta"
      if (atual === 'enviada') return 'aberta';
      return atual === 'cancelada' || atual === 'gerada' ? null : atual;
    case 'upload_valido':
      return COM_LINK.includes(atual) ? 'respondida' : null;
    case 'pedir_correcao':
      return atual === 'respondida' ? 'correcao_solicitada' : null;
    case 'aprovar':
      return atual === 'respondida' ? 'aprovada' : null;
    case 'cancelar':
      return atual === 'aprovada' || atual === 'cancelada' ? null : 'cancelada';
  }
}
