import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapearParaFicha } from '@/lib/ficha/mapping';
import { LoteSchema, MAX_LINHAS_LOTE, jsonIgual, planejarLote, resumir, type ClienteExistente } from '@/lib/importacao/lote';
import { extrairLinha } from '@/lib/rd/extrair';
import { decodificar, parseCsvRd } from '@/lib/rd/parse-csv';

const { linhas } = parseCsvRd(decodificar(readFileSync(new URL('../fixtures/rd-export.csv', import.meta.url))));
const semExistentes = new Map<string, ClienteExistente>();

describe('planejarLote', () => {
  it('fixture inteira: 4 novos, sem erro', () => {
    const plano = planejarLote(linhas, 0, semExistentes);
    expect(resumir(plano.resultados)).toMatchObject({ novos: 4, atualizados: 0, erros: 0 });
    expect(plano.salvar).toHaveLength(4);
    expect(plano.salvar.every((c) => c.dados_rd.campos.rdId === c.rd_id)).toBe(true);
  });

  it('reimportar o mesmo arquivo marca como atualizado (não duplica)', () => {
    const existentes = new Map(linhas.map((l, i) => [l.ID, { id: `c${i}`, ultimaFicha: null }]));
    const plano = planejarLote(linhas, 0, existentes);
    expect(resumir(plano.resultados)).toMatchObject({ novos: 0, atualizados: 4 });
    expect(new Set(plano.salvar.map((c) => c.rd_id)).size).toBe(4);
  });

  it('índices continuam a partir do início do lote', () => {
    const plano = planejarLote(linhas.slice(2), 200, semExistentes);
    expect(plano.resultados.map((r) => r.indice)).toEqual([200, 201]);
  });

  it('linha sem ID vira erro e não é salva', () => {
    const plano = planejarLote([{ Nome: 'Sem ID', ID: '' }, linhas[0]], 0, semExistentes);
    expect(plano.resultados[0]).toMatchObject({ status: 'erro', erro: 'linha sem ID do RD' });
    expect(plano.salvar).toHaveLength(1);
  });

  it('ID repetido no mesmo lote: vale o último, com aviso no anterior', () => {
    const plano = planejarLote(
      [{ ID: 'x1', Nome: 'Primeira' }, { ID: 'x1', Nome: 'Segunda' }],
      0,
      semExistentes,
    );
    expect(plano.salvar).toHaveLength(1);
    expect(plano.salvar[0].nome).toBe('Segunda');
    expect(plano.resultados[0].avisos).toContain('ID repetido no arquivo; vale a última ocorrência');
  });

  it('avisa quando os dados mudaram desde a última ficha gerada', () => {
    const linha = linhas.find((l) => l.ID.endsWith('a03'))!;
    const fichaAtual = mapearParaFicha(extrairLinha(linha).dados.campos);

    const igual = planejarLote([linha], 0, new Map([[linha.ID, { id: 'c', ultimaFicha: fichaAtual }]]));
    expect(igual.resultados[0].fichaMudou).toBe(false);

    const antiga = { ...fichaAtual, telefone: '(16) 90000-0000' };
    const mudou = planejarLote([linha], 0, new Map([[linha.ID, { id: 'c', ultimaFicha: antiga }]]));
    expect(mudou.resultados[0].fichaMudou).toBe(true);
  });
});

describe('jsonIgual', () => {
  it('ignora ordem das chaves (jsonb reordena)', () => {
    expect(jsonIgual({ a: 1, b: { c: [1, 2], d: null } }, { b: { d: null, c: [1, 2] }, a: 1 })).toBe(true);
    expect(jsonIgual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });
});

describe('LoteSchema', () => {
  it(`recusa mais de ${MAX_LINHAS_LOTE} linhas`, () => {
    const muitas = Array.from({ length: MAX_LINHAS_LOTE + 1 }, () => ({ ID: '1' }));
    expect(LoteSchema.safeParse({ inicio: 0, linhas: muitas }).success).toBe(false);
  });
  it('recusa valores que não são texto', () => {
    expect(LoteSchema.safeParse({ inicio: 0, linhas: [{ ID: 1 }] }).success).toBe(false);
  });
});
