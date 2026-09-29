import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { celulaSegura, montarCsv } from '@/lib/ficha/exportar';
import { CAMPOS_LAYOUT } from '@/lib/ficha/layout';

describe('exportação CSV', () => {
  it('uma coluna por campo do layout, com BOM, ";" e acentos', () => {
    const csv = montarCsv([
      {
        rdId: '123',
        status: 'concluida',
        concluidaEm: '2026-09-29T13:00:00Z',
        atualizadoEm: '2026-09-29T13:05:00Z',
        dados: { nome: 'João Ávila', observacoesSaude: 'linha 1\nlinha 2; "aspas"', cpf: null },
      },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    const [cab, linha] = Papa.parse<string[]>(csv.slice(1), { delimiter: ';' }).data;
    expect(cab).toHaveLength(4 + CAMPOS_LAYOUT.length);
    expect(cab.slice(4)).toEqual(CAMPOS_LAYOUT.map((c) => c.rotulo));
    expect(linha[0]).toBe('123');
    expect(linha[1]).toBe('Concluída pelo cliente');
    expect(linha[2]).toBe('29/09/2026, 10:00');
    const col = (chave: string) => linha[4 + CAMPOS_LAYOUT.findIndex((c) => c.chave === chave)];
    expect(col('nome')).toBe('João Ávila');
    expect(col('cpf')).toBe('');
    if (CAMPOS_LAYOUT.some((c) => c.chave === 'observacoesSaude')) expect(col('observacoesSaude')).toBe('linha 1\nlinha 2; "aspas"');
  });

  it('neutraliza fórmulas, mas não telefones', () => {
    expect(celulaSegura('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(celulaSegura('@SUM(A1)')).toBe(`'@SUM(A1)`);
    expect(celulaSegura('-cmd')).toBe(`'-cmd`);
    expect(celulaSegura('+55 11 99999-0000')).toBe('+55 11 99999-0000');
    expect(celulaSegura('(16) 99000-1111')).toBe('(16) 99000-1111');
    expect(celulaSegura('Normal')).toBe('Normal');
  });
});
