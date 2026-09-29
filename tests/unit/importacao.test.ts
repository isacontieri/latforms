import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapearParaFicha } from '@/lib/ficha/mapping';
import {
  LoteSchema, MAX_LINHAS_LOTE, jsonIgual, planejarLote, resumir, type ClienteExistente, type FichaExistente,
} from '@/lib/importacao/lote';
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
    const existentes = new Map<string, ClienteExistente>(linhas.map((l, i) => [l.ID, { id: `c${i}`, ficha: null }]));
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

  describe('ficha: uma por cliente, acompanha o RD até o cliente editar', () => {
    const linha = linhas.find((l) => l.ID.endsWith('a03'))!;
    const atual = mapearParaFicha(extrairLinha(linha).dados.campos);
    const antiga = { ...atual, telefone: '(16) 90000-0000' };
    const com = (status: FichaExistente['status'], snapshot: unknown) =>
      new Map<string, ClienteExistente>([[linha.ID, { id: 'c', ficha: { id: 'f1', status, originais: snapshot } }]]);

    it('sem ficha: nada a atualizar', () => {
      const p = planejarLote([linha], 0, new Map([[linha.ID, { id: 'c', ficha: null }]]));
      expect(p.resultados[0].ficha).toBe('sem_ficha');
      expect(p.atualizarFichas).toEqual([]);
    });

    it.each(['gerada', 'enviada', 'aberta'] as const)('ficha "%s" (cliente não editou) com RD novo é atualizada', (status) => {
      const p = planejarLote([linha], 0, com(status, antiga));
      expect(p.resultados[0].ficha).toBe('atualizada');
      expect(p.atualizarFichas).toEqual([{ fichaId: 'f1', dados: atual }]);
    });

    it('cliente não editou e RD igual: sem mudança', () => {
      const p = planejarLote([linha], 0, com('enviada', atual));
      expect(p.resultados[0].ficha).toBe('sem_mudanca');
      expect(p.atualizarFichas).toEqual([]);
    });

    it.each(['em_preenchimento', 'concluida', 'aprovada'] as const)('ficha "%s" (cliente já editou) nunca é alterada', (status) => {
      const p = planejarLote([linha], 0, com(status, antiga));
      expect(p.resultados[0].ficha).toBe('devolvida_rd_mudou');
      expect(p.atualizarFichas).toEqual([]);
      expect(planejarLote([linha], 0, com(status, atual)).resultados[0].ficha).toBe('devolvida');
    });

    it('resumo conta fichas atualizadas e devolvidas com RD novo', () => {
      expect(resumir(planejarLote([linha], 0, com('aberta', antiga)).resultados)).toMatchObject({ fichasAtualizadas: 1, devolvidasComRdNovo: 0 });
      expect(resumir(planejarLote([linha], 0, com('em_preenchimento', antiga)).resultados)).toMatchObject({ fichasAtualizadas: 0, devolvidasComRdNovo: 1 });
    });
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
