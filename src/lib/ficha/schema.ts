import { z } from 'zod';
import { CAMPOS_FICHA, SIM_NAO, type CampoFicha, type ChaveFicha } from './campos';

/** Valores da ficha: texto livre, "Sim"/"Não" ou uma das opções do campo; `null` = vazio. */
export type DadosFicha = Record<ChaveFicha, string | null>;

function schemaDoCampo(c: CampoFicha) {
  if (c.tipo === 'simNao') return z.enum(SIM_NAO).nullable();
  if (c.tipo === 'opcoes' && c.opcoes) return z.enum(c.opcoes as [string, ...string[]]).nullable();
  return z.string().nullable();
}

export const DadosFichaSchema = z
  .object(Object.fromEntries((CAMPOS_FICHA as readonly CampoFicha[]).map((c) => [c.chave, schemaDoCampo(c)])))
  .strict() as unknown as z.ZodType<DadosFicha>;
