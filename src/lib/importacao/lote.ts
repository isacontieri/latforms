import { z } from 'zod';
import { mapearParaFicha } from '@/lib/ficha/mapping';
import type { DadosFicha } from '@/lib/ficha/schema';
import { aceitaDadosDoRd, type StatusFicha } from '@/lib/ficha/status';
import { extrairLinha, type DadosRd } from '@/lib/rd/extrair';

/** Linhas por requisição: mantém o corpo bem abaixo do limite de 4,5 MB da Vercel. */
export const MAX_LINHAS_LOTE = 200;

const LinhaSchema = z.record(z.string(), z.string());

export const PreviaSchema = z.object({
  inicio: z.number().int().min(0),
  linhas: z.array(LinhaSchema).min(1).max(MAX_LINHAS_LOTE),
});

export const LoteSchema = PreviaSchema;

export const NovaImportacaoSchema = z.object({
  arquivoNome: z.string().trim().min(1).max(255),
  totalLinhas: z.number().int().min(1).max(100_000),
});

export type StatusLinha = 'novo' | 'atualizado' | 'erro';

export interface ResultadoLinha {
  /** Posição do contato no arquivo (0 = primeiro contato depois do cabeçalho). */
  indice: number;
  rdId: string | null;
  nome: string;
  status: StatusLinha;
  avisos: string[];
  erro: string | null;
  /** O que acontece com a ficha do cliente (uma só por cliente; nunca duplica). */
  ficha: AcaoFicha;
}

/**
 * - `sem_ficha`: cliente ainda não tem ficha
 * - `atualizada`: ficha não devolvida recebe os dados novos do RD (o link continua o mesmo)
 * - `sem_mudanca`: dados do RD iguais aos da ficha
 * - `devolvida_rd_mudou`: cliente já devolveu; a versão dele fica e o RD novo aparece para comparação
 * - `devolvida`: cliente já devolveu e o RD não mudou
 */
export type AcaoFicha = 'sem_ficha' | 'atualizada' | 'sem_mudanca' | 'devolvida_rd_mudou' | 'devolvida';

export interface FichaExistente {
  id: string;
  status: StatusFicha;
  versao: number;
  snapshot: unknown;
}

export interface ClienteExistente {
  id: string;
  /** A ficha ativa (não cancelada) do cliente, se houver. */
  ficha: FichaExistente | null;
}

export interface FichaParaAtualizar {
  fichaId: string;
  versao: number;
  snapshot: DadosFicha;
}

export interface ClienteParaSalvar {
  rd_id: string;
  nome: string;
  email: string | null;
  dados_rd: DadosRd;
  dados_ficha: DadosFicha;
}

export interface PlanoLote {
  resultados: ResultadoLinha[];
  salvar: ClienteParaSalvar[];
  /** Fichas ainda não devolvidas que recebem os dados novos do RD. */
  atualizarFichas: FichaParaAtualizar[];
}

/**
 * Decide o que fazer com cada linha: novo, atualizado ou erro. Não toca no banco.
 * ID repetido dentro do lote: vale a última ocorrência (as anteriores ganham aviso).
 */
export function planejarLote(
  linhas: Record<string, string>[],
  inicio: number,
  existentes: Map<string, ClienteExistente>,
): PlanoLote {
  const resultados: ResultadoLinha[] = [];
  const porRdId = new Map<
    string,
    { cliente: ClienteParaSalvar; resultado: ResultadoLinha; atualizar: FichaParaAtualizar | null }
  >();

  linhas.forEach((linha, i) => {
    const ext = extrairLinha(linha);
    const resultado: ResultadoLinha = {
      indice: inicio + i,
      rdId: ext.rdId,
      nome: ext.nome,
      status: 'erro',
      avisos: ext.avisos,
      erro: ext.erro,
      ficha: 'sem_ficha',
    };
    resultados.push(resultado);
    if (ext.erro || !ext.rdId) return;

    const dadosFicha = mapearParaFicha(ext.dados.campos);
    const existente = existentes.get(ext.rdId);
    resultado.status = existente ? 'atualizado' : 'novo';
    const ficha = existente?.ficha ?? null;
    if (ficha) {
      const mudou = !jsonIgual(ficha.snapshot, dadosFicha);
      if (aceitaDadosDoRd(ficha.status)) resultado.ficha = mudou ? 'atualizada' : 'sem_mudanca';
      else resultado.ficha = mudou ? 'devolvida_rd_mudou' : 'devolvida';
    }

    const anterior = porRdId.get(ext.rdId);
    if (anterior) anterior.resultado.avisos.push('ID repetido no arquivo; vale a última ocorrência');
    if (anterior && anterior.resultado.ficha === 'atualizada') anterior.resultado.ficha = 'sem_mudanca';
    porRdId.set(ext.rdId, {
      resultado,
      cliente: { rd_id: ext.rdId, nome: ext.nome, email: ext.email, dados_rd: ext.dados, dados_ficha: dadosFicha },
      atualizar: resultado.ficha === 'atualizada' && ficha ? { fichaId: ficha.id, versao: ficha.versao, snapshot: dadosFicha } : null,
    });
  });

  const valores = [...porRdId.values()];
  return {
    resultados,
    salvar: valores.map((v) => v.cliente),
    atualizarFichas: valores.map((v) => v.atualizar).filter((a): a is FichaParaAtualizar => a !== null),
  };
}

/** Compara JSON ignorando a ordem das chaves (o jsonb do Postgres reordena). */
export function jsonIgual(a: unknown, b: unknown): boolean {
  return JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
}

function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenar((v as Record<string, unknown>)[k])]));
  }
  return v;
}

export function resumir(resultados: ResultadoLinha[]) {
  return {
    novos: resultados.filter((r) => r.status === 'novo').length,
    atualizados: resultados.filter((r) => r.status === 'atualizado').length,
    erros: resultados.filter((r) => r.status === 'erro').length,
    comAviso: resultados.filter((r) => r.avisos.length > 0).length,
    fichasAtualizadas: resultados.filter((r) => r.ficha === 'atualizada').length,
    devolvidasComRdNovo: resultados.filter((r) => r.ficha === 'devolvida_rd_mudou').length,
  };
}
