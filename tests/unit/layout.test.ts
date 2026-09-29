import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { CAMPOS_FICHA } from '@/lib/ficha/campos';
import { camposAlterados, igual } from '@/lib/ficha/diff';
import { CAMPOS_LAYOUT, CAMPOS_PDF, LAYOUT, OBRIGATORIOS, obrigatoriosFaltando, percentualPreenchido, validarValor } from '@/lib/ficha/layout';
import { montarLayout } from '@/lib/ficha/layout-gerar';
import { mascarar } from '@/lib/ficha/mascaras';
import { MODELO_FICHA, gerarFicha, type RecursosFicha } from '@/lib/ficha/pdf/gerar';
import { DadosFichaSchema, type DadosFicha } from '@/lib/ficha/schema';

const arq = (p: string) => new Uint8Array(readFileSync(new URL(`../../${p}`, import.meta.url)));
const recursos: RecursosFicha = {
  fonteRegular: arq('assets/fonts/OpenSans-Regular.ttf'),
  fonteNegrito: arq('assets/fonts/OpenSans-Bold.ttf'),
  fonteItalico: arq('assets/fonts/OpenSans-Italic.ttf'),
  logoPng: arq('assets/templates/logo-latitudes.png'),
};
const vazia = Object.fromEntries(CAMPOS_FICHA.map((c) => [c.chave, null])) as DadosFicha;

describe('ficha-layout.json', () => {
  it('está em sincronia com o gerador do PDF (senão: npm run ficha:layout)', async () => {
    const { pdf, posicoes } = await gerarFicha(vazia, recursos, { semCampos: true });
    const paginas = (await PDFDocument.load(pdf)).getPageCount();
    expect(montarLayout(posicoes, paginas, MODELO_FICHA)).toEqual(LAYOUT);
  });

  it('chaves do layout = campos da ficha = chaves de DadosFicha = campos do PDF', async () => {
    const doLayout = CAMPOS_LAYOUT.map((c) => c.chave).sort();
    expect(doLayout).toEqual(CAMPOS_FICHA.map((c) => c.chave).sort());
    expect(Object.keys(DadosFichaSchema.parse(vazia)).sort()).toEqual(doLayout);
    const { pdf } = await gerarFicha(vazia, recursos);
    const nomesPdf = (await PDFDocument.load(pdf)).getForm().getFields().map((f) => f.getName()).sort();
    expect(Object.values(CAMPOS_PDF).sort()).toEqual(nomesPdf);
  });

  it('as imagens de fundo existem para todas as páginas', () => {
    for (const p of LAYOUT.paginas) expect(() => readFileSync(new URL(`../../public/ficha/${p.fundo}`, import.meta.url))).not.toThrow();
  });

  it('todo campo fica dentro da página e com tamanho útil', () => {
    for (const c of CAMPOS_LAYOUT) {
      expect(c.pos.left).toBeGreaterThanOrEqual(0);
      expect(c.pos.top).toBeGreaterThanOrEqual(0);
      expect(c.pos.left + c.pos.width).toBeLessThanOrEqual(100);
      expect(c.pos.top + c.pos.height).toBeLessThanOrEqual(100);
      expect(c.pos.height, c.chave).toBeGreaterThan(1.5);
    }
  });

  it('obrigatórios existem no layout', () => {
    for (const k of OBRIGATORIOS) expect(CAMPOS_LAYOUT.some((c) => c.chave === k)).toBe(true);
    expect(obrigatoriosFaltando({ nome: 'Ana', email: ' ' })).toEqual(['nascimento', 'cpf', 'telefone', 'email', 'emergenciaNome', 'emergenciaTelefone']);
  });

  it('percentual preenchido', () => {
    expect(percentualPreenchido({})).toBe(0);
    expect(percentualPreenchido(Object.fromEntries(CAMPOS_LAYOUT.map((c) => [c.chave, 'x'])))).toBe(100);
  });
});

describe('validarValor', () => {
  it.each([
    ['nascimento', '18/03/1945', true],
    ['nascimento', '31/02/2020', false],
    ['nascimento', '1945-03-18', false],
    ['cpf', '123.456.789-09', true],
    ['cpf', '123.456.789-00', false],
    ['email', 'ana@latitudes.com.br', true],
    ['email', 'ana@', false],
    ['telefone', '(16) 98000-1111', true],
    ['telefone', '+1 305 555 0100', true],
    ['telefone', '123', false],
    ['cep', '14026-800', true],
    ['cep', 'SW1A 1AA', true],
    ['cep', '1402', false],
    ['sabeNadar', 'Sim', true],
    ['sabeNadar', 'Talvez', false],
    ['estadoCivil', 'Viúvo', true],
  ])('%s = %j → %s', (chave, valor, esperado) => {
    expect(validarValor(chave, valor).ok).toBe(esperado);
  });

  it('vazio vira null; campo desconhecido e tipo errado são recusados', () => {
    expect(validarValor('nome', '   ')).toEqual({ ok: true, valor: null });
    expect(validarValor('nome', null)).toEqual({ ok: true, valor: null });
    expect(validarValor('observacoesInternas', 'x').ok).toBe(false);
    expect(validarValor('nome', 123).ok).toBe(false);
  });

  it('tamanho máximo: 500 (texto) e 1000 (texto longo); quebra de linha só no texto longo', () => {
    expect(validarValor('nome', 'a'.repeat(501)).ok).toBe(false);
    expect(validarValor('comentarios', 'a'.repeat(1000)).ok).toBe(true);
    expect(validarValor('comentarios', 'a'.repeat(1001)).ok).toBe(false);
    expect(validarValor('nome', 'a\nb').ok).toBe(false);
    expect(validarValor('comentarios', 'a\nb')).toEqual({ ok: true, valor: 'a\nb' });
  });
});

describe('mascarar', () => {
  it.each([
    ['cpf', '12345678909', '123.456.789-09'],
    ['cpf', '1234', '123.4'],
    ['cep', '14026800', '14026-800'],
    ['cep', 'SW1A 1AA', 'SW1A 1AA'],
    ['data', '18031945', '18/03/1945'],
    ['data', '1803', '18/03'],
    ['telefone', '16980001111', '(16) 98000-1111'],
    ['telefone', '1133334444', '(11) 3333-4444'],
    ['telefone', '+1 305 555-0100', '+1 305 555-0100'],
  ] as const)('%s: %s → %s', (formato, entrada, saida) => {
    expect(mascarar(formato, entrada)).toBe(saida);
  });
});

describe('diff (amarelo)', () => {
  it('vazio, null e espaços são iguais; espaços nas pontas não contam', () => {
    expect(igual(null, '')).toBe(true);
    expect(igual('', '   ')).toBe(true);
    expect(igual(undefined, null)).toBe(true);
    expect(igual(' Ana ', 'Ana')).toBe(true);
    expect(igual('Ana', 'Ana Maria')).toBe(false);
  });
  it('booleano false × null são diferentes', () => {
    expect(igual(false, null)).toBe(false);
  });
  it('campo revertido ao original não fica alterado', () => {
    expect([...camposAlterados({ nome: 'Ana', cpf: '1' }, { nome: 'Ana', cpf: '2' })]).toEqual(['cpf']);
    expect(camposAlterados({ nome: 'Ana' }, { nome: 'Ana' }).size).toBe(0);
  });
});
