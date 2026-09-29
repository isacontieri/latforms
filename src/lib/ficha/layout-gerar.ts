import { CAMPO_POR_CHAVE, FORMATO_POR_CHAVE, SECOES_FICHA, SIM_NAO, type ChaveFicha, type FormatoCampo } from './campos';
import { DIMENSOES_PAGINA, type PosicaoCampo } from './pdf/gerar';

/** Tipos do ficha-layout.json (mesmos do modelo de 2024; `checkbox` não é usado na ficha de 71 campos). */
export type TipoLayout = 'texto' | 'data' | 'textoLongo' | 'select';

export interface CampoLayout {
  chave: string;
  rotulo: string;
  tipo: TipoLayout;
  /** Nome do campo no PDF gerado (igual à chave). */
  campoPdf: string;
  formato?: FormatoCampo;
  opcoes?: string[];
  secao: string;
  /** Página, começando em 1. */
  pagina: number;
  /** Em % da página, origem no canto superior esquerdo. */
  pos: { left: number; top: number; width: number; height: number };
}

export interface FichaLayout {
  modelo: string;
  pagina: { largura_pt: number; altura_pt: number; proporcao: number };
  paginas: { numero: number; fundo: string }[];
  fonte: { texto_pt: number; select_pt: number };
  campos: CampoLayout[];
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Monta o ficha-layout.json a partir das posições que o gerador do PDF registrou.
 * Ordem dos campos = ordem de leitura (seções e linhas), que também é a ordem do Tab.
 */
export function montarLayout(posicoes: PosicaoCampo[], totalPaginas: number, modelo: string): FichaLayout {
  const { largura: W, altura: H } = DIMENSOES_PAGINA;
  const porChave = new Map(posicoes.map((p) => [p.chave, p]));
  const campos: CampoLayout[] = [];

  for (const secao of SECOES_FICHA) {
    for (const chave of secao.linhas.flat()) {
      const c = CAMPO_POR_CHAVE.get(chave)!;
      const p = porChave.get(chave);
      if (!p) throw new Error(`campo sem posição no PDF: ${chave}`);
      const formato = FORMATO_POR_CHAVE[chave as ChaveFicha];
      const tipo: TipoLayout =
        c.tipo === 'multilinha' ? 'textoLongo' : c.tipo === 'simNao' || c.tipo === 'opcoes' ? 'select' : formato === 'data' ? 'data' : 'texto';
      campos.push({
        chave,
        rotulo: c.rotulo,
        tipo,
        campoPdf: chave,
        ...(formato ? { formato } : {}),
        ...(tipo === 'select' ? { opcoes: c.tipo === 'simNao' ? [...SIM_NAO] : [...(c.opcoes ?? [])] } : {}),
        secao: secao.titulo,
        pagina: p.pagina + 1,
        pos: {
          left: r3((p.x / W) * 100),
          top: r3(((H - (p.y + p.altura)) / H) * 100),
          width: r3((p.largura / W) * 100),
          height: r3((p.altura / H) * 100),
        },
      });
    }
  }

  return {
    modelo,
    pagina: { largura_pt: W, altura_pt: H, proporcao: r3(H / W) },
    paginas: Array.from({ length: totalPaginas }, (_, i) => ({ numero: i + 1, fundo: `pagina-${i + 1}.webp` })),
    fonte: { texto_pt: 10, select_pt: 10 },
    campos,
  };
}
