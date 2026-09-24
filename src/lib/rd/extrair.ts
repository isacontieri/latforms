import * as N from '@/lib/ficha/normalizers';
import {
  CHAVES_RD, COLUNAS_RD, colunaDoCatalogo, normalizarCabecalho,
  type CamposRd, type ColunaRd, type TipoColuna, type ValorCampo,
} from './colunas';
import type { LinhaCsv } from './parse-csv';

/** Conteúdo de `clientes.dados_rd`. */
export interface DadosRd {
  campos: CamposRd;
  /** Colunas que o catálogo não conhece: guardadas como vieram, nada é descartado. */
  extras: Record<string, string>;
  /** Linha bruta (cabeçalho normalizado → valor não vazio), para reprocessar. */
  original: Record<string, string>;
}

export interface LinhaExtraida {
  rdId: string | null;
  nome: string;
  email: string | null;
  dados: DadosRd;
  avisos: string[];
  /** Linha que não pode ser importada (ex.: sem ID). */
  erro: string | null;
}

function normalizar(tipo: TipoColuna, v: string, avisar: N.Avisar): ValorCampo {
  switch (tipo) {
    case 'texto':
    case 'id': return N.texto(v);
    case 'maiusculas': return N.maiusculas(v);
    case 'descricao': return N.descricao(v);
    case 'email': return N.email(v);
    case 'telefone': return N.telefone(v, avisar);
    case 'data': return N.data(v, avisar);
    case 'hora': return N.hora(v);
    case 'simNao': return N.simNao(v);
    case 'cpf': return N.cpf(v, avisar);
    case 'cep': return N.cep(v);
    case 'numero': return N.numero(v, avisar);
    case 'lista': return N.lista(v);
  }
}

function camposVazios(): CamposRd {
  return Object.fromEntries(CHAVES_RD.map((k) => [k, null])) as CamposRd;
}

/** Combina o valor de uma coluna duplicada do RD (ex.: `Estado` / `Estado:`) com o que já existe. */
function combinar(atual: ValorCampo, novo: ValorCampo, coluna: ColunaRd, avisos: string[]): ValorCampo {
  if (novo === null) return atual;
  if (atual === null) return novo;
  if (JSON.stringify(atual) === JSON.stringify(novo)) return atual;
  avisos.push(`${coluna.chave}: colunas duplicadas do RD com valores diferentes; os dois foram mantidos`);
  if (Array.isArray(atual) && Array.isArray(novo)) return [...new Set([...atual, ...novo])];
  return N.juntar(' — ', String(atual), String(novo));
}

export function extrairLinha(linha: LinhaCsv): LinhaExtraida {
  const avisos: string[] = [];
  const campos = camposVazios();
  const extras: Record<string, string> = {};
  const original: Record<string, string> = {};

  for (const [cabecalhoBruto, valor] of Object.entries(linha)) {
    const cabecalho = normalizarCabecalho(cabecalhoBruto);
    if (valor.trim()) original[cabecalho] = valor;

    const coluna = colunaDoCatalogo(cabecalho);
    if (!coluna) {
      if (valor.trim()) extras[cabecalho] = valor.trim();
      continue;
    }
    const avisar: N.Avisar = (m) => avisos.push(`${coluna.coluna}: ${m}`);
    const chave = coluna.chave as keyof CamposRd;
    campos[chave] = combinar(campos[chave], normalizar(coluna.tipo, valor, avisar), coluna, avisos);
  }

  const rdId = campos.rdId as string | null;
  const email = campos.email as string | null;
  let nome = campos.nome as string | null;
  if (!nome) {
    nome = email ?? '(sem nome)';
    avisos.push('contato sem nome');
  }

  return {
    rdId,
    nome,
    email,
    dados: { campos, extras, original },
    avisos,
    erro: rdId ? null : 'linha sem ID do RD',
  };
}

/** Compara os cabeçalhos do arquivo com o catálogo (usado na prévia da importação). */
export function verificarCabecalhos(cabecalhos: string[]): { novas: string[]; ausentes: string[] } {
  const presentes = new Set(cabecalhos.map(normalizarCabecalho));
  return {
    novas: [...presentes].filter((h) => !colunaDoCatalogo(h)),
    ausentes: COLUNAS_RD.map((c) => c.coluna).filter((c) => !presentes.has(normalizarCabecalho(c))),
  };
}

/** Primeira palavra do nome (a coluna "Primeiro nome" do RD às vezes traz o nome completo). */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}
