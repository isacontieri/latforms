import { describe, expect, it } from 'vitest';
import * as N from '@/lib/ficha/normalizers';

function coletar() {
  const avisos: string[] = [];
  return { avisos, avisar: (m: string) => avisos.push(m) };
}

describe('texto', () => {
  it('faz trim e colapsa espaços', () => expect(N.texto('  Casa 3  Cond  ')).toBe('Casa 3 Cond'));
  it.each(['', '   ', 'n/a', 'N/A', '-', null, undefined])('trata %j como vazio', (v) => {
    expect(N.texto(v)).toBeNull();
  });
});

describe('simNao', () => {
  it.each(['sim', 'Sim', 'Sim!', 's', 'yes', ' SIM '])('%j → Sim', (v) => expect(N.simNao(v)).toBe('Sim'));
  it.each(['nao', 'não', 'Não!', 'NAO', 'n', 'no'])('%j → Não', (v) => expect(N.simNao(v)).toBe('Não'));
  it.each(['talvez', 'não sei', '', null])('%j → null', (v) => expect(N.simNao(v)).toBeNull());
});

describe('descricao', () => {
  it('descarta resposta solta de sim/não', () => {
    expect(N.descricao('Não!')).toBeNull();
    expect(N.descricao('sim')).toBeNull();
  });
  it('mantém texto que só começa com não', () => {
    expect(N.descricao('nao gosto de alho')).toBe('nao gosto de alho');
  });
});

describe('data', () => {
  const hoje = new Date(2026, 8, 24);
  it.each([
    ['1960-02-19', '19/02/1960'],
    ['18/03/1945', '18/03/1945'],
    ['1/2/2030', '01/02/2030'],
    ['05/06/26', '05/06/2026'],
    ['05/06/45', '05/06/1945'],
  ])('%s → %s', (entrada, saida) => expect(N.data(entrada, undefined, hoje)).toBe(saida));

  it('rejeita data impossível com aviso', () => {
    const { avisos, avisar } = coletar();
    expect(N.data('31/02/2020', avisar)).toBeNull();
    expect(avisos).toEqual(['data inválida']);
  });
  it('rejeita formato desconhecido com aviso', () => {
    const { avisos, avisar } = coletar();
    expect(N.data('fevereiro de 1960', avisar)).toBeNull();
    expect(avisos).toHaveLength(1);
  });
});

describe('cpf', () => {
  it('formata e aceita dígito válido', () => {
    const { avisos, avisar } = coletar();
    expect(N.cpf('12345678909', avisar)).toBe('123.456.789-09');
    expect(avisos).toEqual([]);
  });
  it('avisa dígito verificador inválido', () => {
    const { avisos, avisar } = coletar();
    expect(N.cpf('123.456.789-00', avisar)).toBe('123.456.789-00');
    expect(avisos).toEqual(['dígito verificador inválido']);
  });
  it('mantém original quando não tem 11 dígitos', () => {
    const { avisos, avisar } = coletar();
    expect(N.cpf('1234', avisar)).toBe('1234');
    expect(avisos).toHaveLength(1);
  });
  it('rejeita dígitos repetidos', () => expect(N.cpfValido('11111111111')).toBe(false));
});

describe('cep', () => {
  it('formata 8 dígitos', () => expect(N.cep('13073540')).toBe('13073-540'));
  it('mantém outro formato', () => expect(N.cep('1234')).toBe('1234'));
});

describe('telefone', () => {
  it.each([
    ['+55 (19) 99888-1234;019998881234', '(19) 99888-1234'],
    ['019998881234', '(19) 99888-1234'],
    ['(16) 9 8000-1111', '(16) 98000-1111'],
    ['16990001111', '(16) 99000-1111'],
    ['(11) 3333-4444', '(11) 3333-4444'],
    ['5511999998888', '(11) 99999-8888'],
    ['0 21 11 99999-8888', '(11) 99999-8888'],
  ])('%s → %s', (entrada, saida) => expect(N.telefone(entrada)).toBe(saida));

  it('mantém número estrangeiro como veio', () => {
    expect(N.telefone('+1 (305) 555-0100')).toBe('+1 (305) 555-0100');
  });
  it('avisa formato não reconhecido', () => {
    const { avisos, avisar } = coletar();
    expect(N.telefone('123', avisar)).toBe('123');
    expect(avisos).toHaveLength(1);
  });
});

describe('outros', () => {
  it('numero aceita vírgula decimal', () => expect(N.numero('1,65')).toBe(1.65));
  it('numero inválido avisa', () => {
    const { avisos, avisar } = coletar();
    expect(N.numero('alto', avisar)).toBeNull();
    expect(avisos).toHaveLength(1);
  });
  it('hora', () => expect(N.hora('9:05')).toBe('09:05'));
  it('lista', () => expect(N.lista('Febre amarela, Covid-19; ')).toEqual(['Febre amarela', 'Covid-19']));
  it('lista vazia', () => expect(N.lista('')).toBeNull());
  it('maiusculas', () => expect(N.maiusculas(' gb123456 ')).toBe('GB123456'));
  it('email', () => expect(N.email(' Fulano@Exemplo.COM ')).toBe('fulano@exemplo.com'));
  it('semAcento', () => expect(N.semAcento('Tétano Antitetânica')).toBe('tetano antitetanica'));
  it('juntar remove vazios e repetidos', () => {
    expect(N.juntar(' — ', 'a', null, '', ' b ', 'a')).toBe('a — b');
    expect(N.juntar(' / ', null, undefined)).toBeNull();
  });
});
