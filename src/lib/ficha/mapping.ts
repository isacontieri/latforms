import type { CamposRd, ValorCampo } from '@/lib/rd/colunas';
import { CAMPOS_FICHA, SIM_NAO, type CampoFicha } from './campos';
import { semAcento } from './normalizers';
import { DadosFichaSchema, type DadosFicha } from './schema';

function paraTexto(v: ValorCampo): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.length ? v.join(', ') : null;
  if (typeof v === 'number') return v.toLocaleString('pt-BR');
  return v;
}

/**
 * Leva `dados_rd.campos` para a ficha: cada campo do RD vai 1:1 para o campo de mesmo nome.
 * Campos sem origem no RD (estado civil, convênio…) ficam em branco para o cliente.
 * Nada de saúde é inferido; sim/não e opções só entram se o valor for exatamente uma opção válida.
 */
export function mapearParaFicha(c: CamposRd): DadosFicha {
  const dados: Record<string, string | null> = {};

  for (const campo of CAMPOS_FICHA as readonly CampoFicha[]) {
    const bruto = campo.origem ? paraTexto(c[campo.origem]) : null;
    if (campo.tipo === 'simNao') dados[campo.chave] = SIM_NAO.includes(bruto as 'Sim') ? bruto : null;
    else if (campo.tipo === 'opcoes') dados[campo.chave] = campo.opcoes?.includes(bruto ?? '') ? bruto : null;
    else dados[campo.chave] = bruto;
  }

  // ajustes de apresentação (não inventam dado)
  if (dados.tipoSanguineo) dados.tipoSanguineo = dados.tipoSanguineo.replace(/\s+/g, '').toUpperCase();
  if (!dados.pais && dados.nacionalidade && semAcento(dados.nacionalidade).startsWith('brasileir')) dados.pais = 'Brasil';

  return DadosFichaSchema.parse(dados);
}
