import { describe, expect, it } from 'vitest';
import { aceitaDadosDoRd, editavelPeloCliente, proximoStatus, type EventoFicha, type StatusFicha } from '@/lib/ficha/status';

const TODOS: StatusFicha[] = ['gerada', 'enviada', 'aberta', 'em_preenchimento', 'concluida', 'aprovada', 'cancelada'];
const EVENTOS: EventoFicha[] = ['gerar_link', 'primeiro_acesso', 'concluir', 'aprovar', 'reabrir', 'cancelar'];

// [de, evento, para] — tudo o que não está aqui é recusado
const PERMITIDAS: [StatusFicha, EventoFicha, StatusFicha][] = [
  ['gerada', 'gerar_link', 'enviada'],
  ...(['enviada', 'aberta', 'em_preenchimento', 'concluida', 'aprovada'] as StatusFicha[]).map((s) => [s, 'gerar_link', s] as [StatusFicha, EventoFicha, StatusFicha]),
  ['enviada', 'primeiro_acesso', 'aberta'],
  ...(['gerada', 'aberta', 'em_preenchimento', 'concluida', 'aprovada'] as StatusFicha[]).map((s) => [s, 'primeiro_acesso', s] as [StatusFicha, EventoFicha, StatusFicha]),
  ['enviada', 'concluir', 'concluida'],
  ['aberta', 'concluir', 'concluida'],
  ['em_preenchimento', 'concluir', 'concluida'],
  ['concluida', 'aprovar', 'aprovada'],
  ['concluida', 'reabrir', 'em_preenchimento'],
  ['aprovada', 'reabrir', 'em_preenchimento'],
  ...(['gerada', 'enviada', 'aberta', 'em_preenchimento', 'concluida'] as StatusFicha[]).map((s) => [s, 'cancelar', 'cancelada'] as [StatusFicha, EventoFicha, StatusFicha]),
];

describe('proximoStatus', () => {
  it.each(PERMITIDAS)('%s + %s → %s', (de, evento, para) => expect(proximoStatus(de, evento)).toBe(para));

  it('qualquer outra transição é recusada', () => {
    for (const de of TODOS) for (const e of EVENTOS) {
      if (!PERMITIDAS.some(([d, ev]) => d === de && ev === e)) expect(proximoStatus(de, e), `${de} + ${e}`).toBeNull();
    }
  });
});

describe('regras da v3', () => {
  it('a ficha acompanha o RD só até o cliente editar o primeiro campo', () => {
    expect(TODOS.filter(aceitaDadosDoRd)).toEqual(['gerada', 'enviada', 'aberta']);
  });
  it('o cliente edita só com link ativo e antes de concluir', () => {
    expect(TODOS.filter(editavelPeloCliente)).toEqual(['enviada', 'aberta', 'em_preenchimento']);
  });
});
