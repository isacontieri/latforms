import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLUNAS_RD, normalizarCabecalho } from '@/lib/rd/colunas';
import { decodificar, parseCsvRd } from '@/lib/rd/parse-csv';

const FIXTURE = new URL('../fixtures/rd-export.csv', import.meta.url);

describe('parseCsvRd com a fixture do RD', () => {
  const csv = parseCsvRd(decodificar(readFileSync(FIXTURE)));

  it('lê as 4 linhas sem erros estruturais', () => {
    expect(csv.erros).toEqual([]);
    expect(csv.linhas).toHaveLength(4);
  });

  it('descarta a linha sep= e normaliza os cabeçalhos', () => {
    expect(csv.cabecalhos[0]).toBe('Nome');
    expect(csv.cabecalhos).toContain('Por favor, descreva os medicamentos de uso contínuo:');
    expect(csv.cabecalhos).toContain('Gostaria de fazer alguma observação ou solicitação extra?');
  });

  it('reconhece todas as colunas do catálogo', () => {
    const esperadas = COLUNAS_RD.map((c) => normalizarCabecalho(c.coluna));
    expect(csv.cabecalhos).toEqual(esperadas);
  });
});

describe('parseCsvRd — casos de borda', () => {
  it('remove BOM antes da linha sep= e aceita outro delimitador', () => {
    const csv = parseCsvRd('﻿sep=;\r\nID;Nome\r\n1;Ana\r\n');
    expect(csv.linhas).toEqual([{ ID: '1', Nome: 'Ana' }]);
  });

  it('funciona sem a linha sep=', () => {
    expect(parseCsvRd('ID,Nome\n1,Ana\n').linhas).toEqual([{ ID: '1', Nome: 'Ana' }]);
  });

  it('ignora linhas vazias', () => {
    expect(parseCsvRd('ID,Nome\n1,Ana\n\n  \n2,Bia\n').linhas).toHaveLength(2);
  });

  it('combina cabeçalhos que colidem depois de normalizados (primeiro não vazio)', () => {
    const csv = parseCsvRd('ID,Nome, Nome\n1,,Ana\n2,Bia,Outra\n');
    expect(csv.cabecalhos).toEqual(['ID', 'Nome']);
    expect(csv.linhas).toEqual([{ ID: '1', Nome: 'Ana' }, { ID: '2', Nome: 'Bia' }]);
  });

  it('registra linha com número errado de colunas', () => {
    expect(parseCsvRd('ID,Nome\n1,Ana,extra\n').erros).toHaveLength(1);
  });

  it('decodifica windows-1252 quando não é UTF-8 válido', () => {
    const bytes = Uint8Array.from([0x49, 0x44, 0x2c, 0x50, 0x61, 0xed, 0x73]); // "ID,País" em cp1252
    expect(decodificar(bytes)).toBe('ID,País');
  });
});
