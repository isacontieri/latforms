import { describe, expect, it } from 'vitest';
import { mensagemSenha, problemasDaSenha } from '@/lib/equipe/senha';
import { avisosDeDuplicidade, type DocContato } from '@/lib/importacao/lote';

describe('regra de senha dos funcionários', () => {
  it('aceita senha com 8+, maiúscula, minúscula, número e especial', () => {
    expect(problemasDaSenha('Latitudes#2026')).toEqual([]);
    expect(mensagemSenha([])).toBeNull();
  });

  it.each([
    ['Lat#1a', 'ter pelo menos 8 caracteres'],
    ['latitudes#2026', 'ter uma letra maiúscula'],
    ['LATITUDES#2026', 'ter uma letra minúscula'],
    ['Latitudes#abc', 'ter um número'],
    ['Latitudes2026', 'ter um caractere especial (ex.: # @ ! %)'],
  ])('"%s" precisa %s', (senha, falta) => {
    expect(problemasDaSenha(senha)).toContain(falta);
  });

  it('mensagem lista tudo o que falta', () => {
    expect(mensagemSenha(problemasDaSenha('abc'))).toMatch(/^A senha precisa ter pelo menos 8 caracteres, .*número.*especial/);
  });
});

describe('avisosDeDuplicidade', () => {
  const ana: DocContato = { indice: 0, rdId: 'rd1', nome: 'Ana', cpf: '123.456.789-09', email: 'Ana@Ex.com' };

  it('mesmo CPF (com ou sem pontuação) e outro ID do RD no banco', () => {
    const avisos = avisosDeDuplicidade([ana], [{ rdId: 'rd9', nome: 'Ana Souza', cpf: '12345678909', email: null }], false);
    expect(avisos.get(0)).toEqual(['Possível duplicado: mesmo CPF de Ana Souza (outro ID do RD)']);
  });

  it('mesmo e-mail ignorando maiúsculas', () => {
    const avisos = avisosDeDuplicidade([ana], [{ rdId: 'rd9', nome: 'Ana S.', cpf: null, email: 'ana@ex.com ' }], false);
    expect(avisos.get(0)).toEqual(['Possível duplicado: mesmo e-mail de Ana S. (outro ID do RD)']);
  });

  it('mesmo ID do RD não é duplicado (é o próprio cliente sendo atualizado)', () => {
    expect(avisosDeDuplicidade([ana], [{ ...ana, indice: undefined }], true).size).toBe(0);
  });

  it('dentro do arquivo, aponta o número do outro contato', () => {
    const bia: DocContato = { indice: 5, rdId: 'rd2', nome: 'Bia', cpf: null, email: 'ana@ex.com' };
    const avisos = avisosDeDuplicidade([ana, bia], [], true);
    expect(avisos.get(0)).toEqual(['Possível duplicado no arquivo: mesmo e-mail do contato nº 6 (Bia)']);
    expect(avisos.get(5)).toEqual(['Possível duplicado no arquivo: mesmo e-mail do contato nº 1 (Ana)']);
  });

  it('CPF incompleto não compara', () => {
    const avisos = avisosDeDuplicidade([{ ...ana, cpf: '1234', email: null }], [{ rdId: 'x', nome: 'X', cpf: '1234', email: null }], false);
    expect(avisos.size).toBe(0);
  });
});
