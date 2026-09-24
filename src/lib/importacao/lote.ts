import { z } from 'zod';
import { mapearParaFicha } from '@/lib/ficha/mapping';
import type { DadosFicha } from '@/lib/ficha/schema';
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
  /** Cliente já tem ficha gerada e os dados do RD mudaram desde então. */
  fichaMudou: boolean;
}

export interface ClienteExistente {
  id: string;
  /** `dados_snapshot` da ficha mais recente, se houver. */
  ultimaFicha: unknown | null;
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
  const porRdId = new Map<string, { cliente: ClienteParaSalvar; resultado: ResultadoLinha }>();

  linhas.forEach((linha, i) => {
    const ext = extrairLinha(linha);
    const resultado: ResultadoLinha = {
      indice: inicio + i,
      rdId: ext.rdId,
      nome: ext.nome,
      status: 'erro',
      avisos: ext.avisos,
      erro: ext.erro,
      fichaMudou: false,
    };
    resultados.push(resultado);
    if (ext.erro || !ext.rdId) return;

    const dadosFicha = mapearParaFicha(ext.dados.campos);
    const existente = existentes.get(ext.rdId);
    resultado.status = existente ? 'atualizado' : 'novo';
    resultado.fichaMudou = existente?.ultimaFicha != null && !jsonIgual(existente.ultimaFicha, dadosFicha);

    const anterior = porRdId.get(ext.rdId);
    if (anterior) anterior.resultado.avisos.push('ID repetido no arquivo; vale a última ocorrência');
    porRdId.set(ext.rdId, {
      resultado,
      cliente: { rd_id: ext.rdId, nome: ext.nome, email: ext.email, dados_rd: ext.dados, dados_ficha: dadosFicha },
    });
  });

  return { resultados, salvar: [...porRdId.values()].map((v) => v.cliente) };
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
    fichasDesatualizadas: resultados.filter((r) => r.fichaMudou).length,
  };
}
