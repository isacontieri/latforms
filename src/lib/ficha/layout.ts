import { cpfValido } from './normalizers';
import layoutJson from './ficha-layout.json';
import type { CampoLayout, FichaLayout } from './layout-gerar';
import type { ChaveFicha } from './campos';

/**
 * ficha-layout.json é a fonte da verdade da ficha web: campos, tipos, opções, formato e posição.
 * (Gerado a partir do PDF por `npm run ficha:layout`; o teste layout.test.ts garante a sincronia.)
 */
export const LAYOUT = layoutJson as FichaLayout;
export const CAMPOS_LAYOUT: readonly CampoLayout[] = LAYOUT.campos;
export const CAMPO_LAYOUT = new Map<string, CampoLayout>(CAMPOS_LAYOUT.map((c) => [c.chave, c]));

/** Nome de cada campo no PDF final, derivado do layout (nunca duplicado à mão). */
export const CAMPOS_PDF = Object.fromEntries(CAMPOS_LAYOUT.map((c) => [c.chave, c.campoPdf])) as Record<ChaveFicha, string>;

/**
 * Campos obrigatórios para "Concluir ficha".
 * TODO(v3): lista provisória definida pela responsável — confirmar com a equipe comercial.
 */
export const OBRIGATORIOS = ['nome', 'nascimento', 'cpf', 'telefone', 'email', 'emergenciaNome', 'emergenciaTelefone'] as const satisfies readonly ChaveFicha[];

export const TAMANHO_MAXIMO = { texto: 500, textoLongo: 1000 } as const;

export function eChaveDaFicha(chave: string): chave is ChaveFicha {
  return CAMPO_LAYOUT.has(chave);
}

export type ValidacaoValor = { ok: true; valor: string | null } | { ok: false; erro: string };

function dataValida(v: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return false;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(a, mes - 1, d));
  return a >= 1900 && a <= 2100 && dt.getUTCFullYear() === a && dt.getUTCMonth() === mes - 1 && dt.getUTCDate() === d;
}

/**
 * Valida o valor de UM campo (mesma regra no navegador e na API). Vazio = null.
 * Mensagens em tom acolhedor, sem repetir o valor digitado.
 */
export function validarValor(chave: string, bruto: unknown): ValidacaoValor {
  const campo = CAMPO_LAYOUT.get(chave);
  if (!campo) return { ok: false, erro: 'Campo desconhecido' };
  if (bruto !== null && typeof bruto !== 'string') return { ok: false, erro: 'Valor inválido' };
  const valor = bruto?.replace(/\r\n?/g, '\n').trim() ?? '';
  if (!valor) return { ok: true, valor: null };

  const max = campo.tipo === 'textoLongo' ? TAMANHO_MAXIMO.textoLongo : TAMANHO_MAXIMO.texto;
  if (valor.length > max) return { ok: false, erro: `Use no máximo ${max} caracteres.` };
  if (campo.tipo !== 'textoLongo' && valor.includes('\n')) return { ok: false, erro: 'Use uma linha só.' };

  if (campo.tipo === 'select') {
    return campo.opcoes?.includes(valor) ? { ok: true, valor } : { ok: false, erro: 'Escolha uma das opções da lista.' };
  }
  switch (campo.formato) {
    case 'data':
      return dataValida(valor) ? { ok: true, valor } : { ok: false, erro: 'Data inválida. Use o formato DD/MM/AAAA.' };
    case 'cpf': {
      const d = valor.replace(/\D/g, '');
      return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(valor) && cpfValido(d) ? { ok: true, valor } : { ok: false, erro: 'CPF inválido. Confira os números.' };
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor) ? { ok: true, valor } : { ok: false, erro: 'E-mail inválido.' };
    case 'telefone':
      return /^\+?[\d\s().-]{8,25}$/.test(valor) && valor.replace(/\D/g, '').length >= 8
        ? { ok: true, valor }
        : { ok: false, erro: 'Telefone inválido. Inclua o DDD (ou o DDI, se for de fora do Brasil).' };
    case 'cep':
      // CEP brasileiro 00000-000 ou código postal de outro país (letras, números, espaço e hífen)
      return /^\d{5}-\d{3}$/.test(valor) || (/^[A-Za-z0-9 -]{3,12}$/.test(valor) && /[A-Za-z]/.test(valor))
        ? { ok: true, valor }
        : { ok: false, erro: 'CEP inválido. Use o formato 00000-000.' };
    default:
      return { ok: true, valor };
  }
}

/** Campos obrigatórios ainda vazios (para liberar "Concluir ficha"). */
export function obrigatoriosFaltando(dados: Partial<Record<string, string | null>>): ChaveFicha[] {
  return OBRIGATORIOS.filter((k) => !dados[k]?.toString().trim());
}

/** % preenchido (campos com valor / total), para a lista do painel. */
export function percentualPreenchido(dados: Partial<Record<string, unknown>>): number {
  const preenchidos = CAMPOS_LAYOUT.filter((c) => {
    const v = dados[c.chave];
    return typeof v === 'string' ? v.trim() !== '' : v !== null && v !== undefined;
  }).length;
  return Math.round((preenchidos / CAMPOS_LAYOUT.length) * 100);
}
