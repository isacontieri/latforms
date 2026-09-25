import { describe, expect, it } from 'vitest';
import { proximoStatus, type EventoFicha, type StatusFicha } from '@/lib/ficha/status';

const TODOS: StatusFicha[] = ['gerada', 'enviada', 'aberta', 'respondida', 'correcao_solicitada', 'aprovada', 'cancelada'];

// Tabela da skill §8: [de, evento, para]
const PERMITIDAS: [StatusFicha, EventoFicha, StatusFicha][] = [
  ['gerada', 'gerar_link', 'enviada'],
  ['enviada', 'gerar_link', 'enviada'],
  ['aberta', 'gerar_link', 'aberta'],
  ['respondida', 'gerar_link', 'respondida'],
  ['correcao_solicitada', 'gerar_link', 'correcao_solicitada'],
  ['enviada', 'baixar_pdf', 'aberta'],
  ['aberta', 'baixar_pdf', 'aberta'],
  ['respondida', 'baixar_pdf', 'respondida'],
  ['correcao_solicitada', 'baixar_pdf', 'correcao_solicitada'],
  ['aprovada', 'baixar_pdf', 'aprovada'],
  ['enviada', 'upload_valido', 'respondida'],
  ['aberta', 'upload_valido', 'respondida'],
  ['respondida', 'upload_valido', 'respondida'],
  ['correcao_solicitada', 'upload_valido', 'respondida'],
  ['respondida', 'pedir_correcao', 'correcao_solicitada'],
  ['respondida', 'aprovar', 'aprovada'],
  ...(['gerada', 'enviada', 'aberta', 'respondida', 'correcao_solicitada'] as StatusFicha[]).map(
    (s) => [s, 'cancelar', 'cancelada'] as [StatusFicha, EventoFicha, StatusFicha],
  ),
];

describe('proximoStatus', () => {
  it.each(PERMITIDAS)('%s + %s → %s', (de, evento, para) => {
    expect(proximoStatus(de, evento)).toBe(para);
  });

  it('qualquer outra transição é recusada', () => {
    const eventos: EventoFicha[] = ['gerar_link', 'baixar_pdf', 'upload_valido', 'pedir_correcao', 'aprovar', 'cancelar'];
    for (const de of TODOS) {
      for (const evento of eventos) {
        const permitida = PERMITIDAS.some(([d, e]) => d === de && e === evento);
        if (!permitida) expect(proximoStatus(de, evento), `${de} + ${evento}`).toBeNull();
      }
    }
  });

  it('aprovada não aceita novo envio e cancelada não aceita nada', () => {
    expect(proximoStatus('aprovada', 'upload_valido')).toBeNull();
    expect(proximoStatus('cancelada', 'baixar_pdf')).toBeNull();
  });
});
