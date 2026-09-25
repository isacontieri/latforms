import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument, PDFDropdown, PDFTextField, StandardFonts, rgb,
  type PDFFont, type PDFImage, type PDFPage, type RGB,
} from 'pdf-lib';
import { CAMPO_POR_CHAVE, SECOES_FICHA, SIM_NAO, type CampoFicha } from '../campos';
import { semAcento } from '../normalizers';
import type { DadosFicha } from '../schema';
import { paraWinAnsi } from './winansi';

/** Arquivos de marca: carregados do disco no servidor (recursos.ts) ou nos testes. */
export interface RecursosFicha {
  fonteRegular: Uint8Array;
  fonteNegrito: Uint8Array;
  fonteItalico: Uint8Array;
  logoPng: Uint8Array;
}

export interface FichaGerada {
  pdf: Uint8Array;
  /** Avisos sem conteúdo dos campos (só a chave e o problema). */
  avisos: string[];
}

export const PLACEHOLDER_DROPDOWN = '---Selecione---';
/** Assunto gravado no PDF para identificar a versão do modelo. */
export const MODELO_FICHA = 'LatForms — Ficha de Cadastro v2';

// Cores medidas no modelo de 2024
const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const LARANJA = hex('#DA8E1E');
const ROTULO = hex('#5C4E43');
const TEXTO = hex('#181715');
const CAMPO = hex('#CFD6DA');
const CINZA = hex('#8A8580');

// Página A4 e grade
const LARGURA = 595.28;
const ALTURA = 841.89;
const MARGEM_X = 36;
const MARGEM_INFERIOR = 48;
const UTIL = LARGURA - 2 * MARGEM_X;
const COLUNAS = 12;
const CALHA = 12;
const LARGURA_COLUNA = (UTIL - (COLUNAS - 1) * CALHA) / COLUNAS;

const TAM_ROTULO = 8.5;
const ENTRELINHA_ROTULO = 11;
const ALTURA_CAMPO = 18;
const ALTURA_MULTILINHA = 36;
const LARGURA_DROPDOWN_SN = 92;
const ESPACO_LINHA = 9;
const FONTE_CAMPO = 10;
const FONTE_MINIMA = 6.5;

const larguraDe = (colunas: number) => colunas * LARGURA_COLUNA + (colunas - 1) * CALHA;
const emLinha = (c: CampoFicha) => c.tipo === 'simNao' || c.emLinha === true;

interface Fontes {
  regular: PDFFont;
  negrito: PDFFont;
  italico: PDFFont;
  campo: PDFFont; // Helvetica: os leitores de PDF editam campos com ela sem problemas
}

function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of texto.split(/\s+/)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura || !atual) atual = tentativa;
    else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

type Trecho = { texto: string; fonte: PDFFont; cor: RGB };

/** Parágrafo com trechos de estilos diferentes (ex.: final em laranja itálico). Devolve o y final. */
function paragrafo(page: PDFPage, trechos: Trecho[], x: number, yTopo: number, largura: number, tamanho: number, entrelinha: number): number {
  const palavras = trechos.flatMap((t) => t.texto.split(/\s+/).filter(Boolean).map((p) => ({ ...t, texto: p })));
  let linha: typeof palavras = [];
  let y = yTopo - tamanho;
  const larguraLinha = (ps: typeof palavras) =>
    ps.reduce((s, p, i) => s + p.fonte.widthOfTextAtSize(p.texto, tamanho) + (i ? p.fonte.widthOfTextAtSize(' ', tamanho) : 0), 0);
  const desenhar = () => {
    let cx = x;
    for (const [i, p] of linha.entries()) {
      if (i) cx += p.fonte.widthOfTextAtSize(' ', tamanho);
      page.drawText(p.texto, { x: cx, y, size: tamanho, font: p.fonte, color: p.cor });
      cx += p.fonte.widthOfTextAtSize(p.texto, tamanho);
    }
  };
  for (const p of palavras) {
    if (linha.length && larguraLinha([...linha, p]) > largura) {
      desenhar();
      linha = [];
      y -= entrelinha;
    }
    linha.push(p);
  }
  if (linha.length) desenhar();
  return y - (entrelinha - tamanho);
}

/** Reduz a fonte do campo até o texto caber. Devolve false se nem no mínimo couber (o leitor rola). */
function ajustarFonte(campo: PDFTextField, texto: string, fonte: PDFFont, largura: number, altura: number, multilinha: boolean): boolean {
  const larguraUtil = largura - 4;
  const cabe = (t: number) => {
    if (!multilinha) return fonte.widthOfTextAtSize(texto, t) <= larguraUtil;
    const linhas = texto.split('\n').reduce((n, par) => n + Math.max(1, Math.ceil(fonte.widthOfTextAtSize(par, t) / larguraUtil)), 0);
    return linhas * t * 1.15 <= altura - 4;
  };
  for (let t = FONTE_CAMPO; t >= FONTE_MINIMA; t -= 0.5) {
    if (!texto || cabe(t)) {
      campo.setFontSize(t);
      return true;
    }
  }
  campo.setFontSize(FONTE_MINIMA);
  return false;
}

/**
 * Gera a Ficha de Cadastro inteira (várias páginas A4) com os campos editáveis já preenchidos.
 * NUNCA chama `form.flatten()`: o cliente confere e completa no próprio PDF.
 */
export async function gerarFicha(dados: DadosFicha, recursos: RecursosFicha): Promise<FichaGerada> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontes: Fontes = {
    regular: await pdf.embedFont(recursos.fonteRegular, { subset: true }),
    negrito: await pdf.embedFont(recursos.fonteNegrito, { subset: true }),
    italico: await pdf.embedFont(recursos.fonteItalico, { subset: true }),
    campo: await pdf.embedFont(StandardFonts.Helvetica),
  };
  const logo = await pdf.embedPng(recursos.logoPng);
  const form = pdf.getForm();
  const avisos: string[] = [];

  let page = novaPagina(pdf, fontes, logo, true);
  let y = cabecalhoPrincipal(page, fontes, logo);

  const quebraSeNecessario = (altura: number) => {
    if (y - altura < MARGEM_INFERIOR) {
      page = novaPagina(pdf, fontes, logo, false);
      y = ALTURA - 78;
    }
  };

  for (const secao of SECOES_FICHA) {
    const linhas = secao.linhas.map((chaves) => medirLinha(chaves.map((k) => CAMPO_POR_CHAVE.get(k)!), fontes));
    quebraSeNecessario(34 + linhas[0].altura); // título nunca fica sozinho no pé da página
    y -= 14;
    page.drawText(secao.titulo.toUpperCase(), { x: MARGEM_X, y: y - 11, size: 11, font: fontes.negrito, color: LARANJA });
    y -= 16;
    page.drawLine({ start: { x: MARGEM_X, y }, end: { x: LARGURA - MARGEM_X, y }, thickness: 0.75, color: CAMPO });
    y -= 10;

    for (const [i, linha] of linhas.entries()) {
      // pergunta sim/não + sua descrição logo abaixo nunca se separam numa quebra de página
      const proxima = linhas[i + 1];
      const perguntaComDescricao =
        linha.celulas.length === 1 && linha.celulas[0].campo.tipo === 'simNao' &&
        proxima?.celulas.length === 1 && proxima.celulas[0].campo.tipo === 'multilinha';
      quebraSeNecessario(linha.altura + (perguntaComDescricao ? ESPACO_LINHA + proxima.altura : 0));
      desenharLinha(page, linha, y, fontes, form, dados, avisos);
      y -= linha.altura + ESPACO_LINHA;
    }
  }

  // rodapé com numeração
  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    const txt = `Página ${i + 1} de ${paginas.length}`;
    const w = fontes.regular.widthOfTextAtSize(txt, 8);
    p.drawText(txt, { x: (LARGURA - w) / 2, y: 24, size: 8, font: fontes.regular, color: CINZA });
  });

  form.updateFieldAppearances(fontes.campo);
  // NUNCA: form.flatten()

  const nome = dados.nome ? paraWinAnsi(fontes.campo, dados.nome, false).texto : null;
  pdf.setTitle(nome ? `Ficha de Cadastro — ${nome}` : 'Ficha de Cadastro');
  pdf.setSubject(MODELO_FICHA);
  pdf.setAuthor('Latitudes');
  pdf.setProducer('LatForms — Latitudes');
  pdf.setCreator('LatForms');
  return { pdf: await pdf.save(), avisos };
}

function novaPagina(pdf: PDFDocument, f: Fontes, logo: PDFImage, primeira: boolean): PDFPage {
  const page = pdf.addPage([LARGURA, ALTURA]);
  if (!primeira) {
    const w = 70;
    page.drawImage(logo, { x: MARGEM_X, y: ALTURA - 26 - w / (logo.width / logo.height), width: w, height: w / (logo.width / logo.height) });
    const titulo = 'FICHA DE CADASTRO';
    page.drawText(titulo, {
      x: LARGURA - MARGEM_X - f.negrito.widthOfTextAtSize(titulo, 9),
      y: ALTURA - 42,
      size: 9,
      font: f.negrito,
      color: LARANJA,
    });
  }
  return page;
}

/** Cabeçalho da 1ª página, como no modelo de 2024. Devolve o y onde o conteúdo começa. */
function cabecalhoPrincipal(page: PDFPage, f: Fontes, logo: PDFImage): number {
  // mesmas posições do modelo de 2024: logo 103,8 × 31,1 pt no canto; título laranja em Open Sans Bold 13
  const logoW = 103.8;
  const logoH = logoW / (logo.width / logo.height);
  page.drawImage(logo, { x: MARGEM_X, y: ALTURA - 27 - logoH, width: logoW, height: logoH });
  page.drawText('FICHA DE CADASTRO', { x: 231, y: ALTURA - 57, size: 13, font: f.negrito, color: LARANJA });
  return paragrafo(
    page,
    [
      {
        texto:
          'As informações presentes nesta ficha são confidenciais e de extrema importância para a organização da viagem. ' +
          'Por gentileza, confira os dados já preenchidos e complete os que faltam. Ao terminar, salve o arquivo no seu ' +
          'computador e envie pelo mesmo link em que você o recebeu.',
        fonte: f.regular,
        cor: TEXTO,
      },
      { texto: 'Por favor, não preencher à mão.', fonte: f.italico, cor: LARANJA },
    ],
    MARGEM_X,
    ALTURA - 27 - logoH - 22,
    UTIL,
    10.5,
    15,
  ) - 4;
}

interface Celula {
  campo: CampoFicha;
  x: number;
  largura: number;
  rotulo: string[];
}
interface LinhaMedida {
  celulas: Celula[];
  alturaRotulo: number;
  altura: number;
}

function medirLinha(campos: CampoFicha[], f: Fontes): LinhaMedida {
  let x = MARGEM_X;
  const celulas = campos.map((campo) => {
    const largura = larguraDe(campo.colunas);
    const larguraRotulo = emLinha(campo) ? largura - LARGURA_DROPDOWN_SN - 10 : largura;
    const c: Celula = { campo, x, largura, rotulo: quebrar(campo.rotulo, f.negrito, TAM_ROTULO, larguraRotulo) };
    x += largura + CALHA;
    return c;
  });
  const empilhadas = celulas.filter((c) => !emLinha(c.campo));
  const alturaRotulo = Math.max(0, ...empilhadas.map((c) => c.rotulo.length * ENTRELINHA_ROTULO));
  const alturas = celulas.map((c) =>
    emLinha(c.campo)
      ? Math.max(ALTURA_CAMPO, c.rotulo.length * ENTRELINHA_ROTULO)
      : alturaRotulo + 3 + (c.campo.tipo === 'multilinha' ? ALTURA_MULTILINHA : ALTURA_CAMPO),
  );
  return { celulas, alturaRotulo, altura: Math.max(...alturas) };
}

function desenharLinha(
  page: PDFPage,
  linha: LinhaMedida,
  yTopo: number,
  f: Fontes,
  form: ReturnType<PDFDocument['getForm']>,
  dados: DadosFicha,
  avisos: string[],
) {
  for (const c of linha.celulas) {
    const { campo } = c;
    const valor = dados[campo.chave as keyof DadosFicha] ?? null;

    if (emLinha(campo)) {
      // pergunta à esquerda, lista à direita, centralizadas na vertical
      const alturaTexto = c.rotulo.length * ENTRELINHA_ROTULO;
      const alturaCelula = Math.max(ALTURA_CAMPO, alturaTexto);
      c.rotulo.forEach((l, i) =>
        page.drawText(l, {
          x: c.x,
          y: yTopo - (alturaCelula - alturaTexto) / 2 - TAM_ROTULO - i * ENTRELINHA_ROTULO,
          size: TAM_ROTULO,
          font: f.negrito,
          color: ROTULO,
        }),
      );
      const opcoes = campo.tipo === 'simNao' ? [...SIM_NAO] : [...(campo.opcoes ?? [])];
      criarDropdown(form, page, campo, opcoes, valor, avisos, {
        x: c.x + c.largura - LARGURA_DROPDOWN_SN,
        y: yTopo - (alturaCelula + ALTURA_CAMPO) / 2,
        width: LARGURA_DROPDOWN_SN,
        height: ALTURA_CAMPO,
      }, f);
      continue;
    }

    c.rotulo.forEach((l, i) =>
      page.drawText(l, { x: c.x, y: yTopo - TAM_ROTULO - i * ENTRELINHA_ROTULO, size: TAM_ROTULO, font: f.negrito, color: ROTULO }),
    );
    const altura = campo.tipo === 'multilinha' ? ALTURA_MULTILINHA : ALTURA_CAMPO;
    const ret = { x: c.x, y: yTopo - linha.alturaRotulo - 3 - altura, width: c.largura, height: altura };

    if (campo.tipo === 'opcoes') {
      criarDropdown(form, page, campo, [...(campo.opcoes ?? [])], valor, avisos, ret, f);
      continue;
    }

    const tf = form.createTextField(campo.chave);
    const multilinha = campo.tipo === 'multilinha';
    if (multilinha) tf.enableMultiline();
    const { texto, removidos } = paraWinAnsi(f.campo, valor ?? '', multilinha);
    if (removidos) avisos.push(`${campo.chave}: ${removidos} caractere(s) não suportado(s) pelo PDF foram removidos`);
    tf.setText(texto || undefined);
    tf.addToPage(page, { ...ret, font: f.campo, backgroundColor: CAMPO, borderWidth: 0, textColor: TEXTO });
    if (!ajustarFonte(tf, texto, f.campo, ret.width, ret.height, multilinha)) {
      avisos.push(`${campo.chave}: texto longo não cabe inteiro no campo (o leitor rola)`);
    }
  }
}

function criarDropdown(
  form: ReturnType<PDFDocument['getForm']>,
  page: PDFPage,
  campo: CampoFicha,
  opcoes: string[],
  valor: string | null,
  avisos: string[],
  ret: { x: number; y: number; width: number; height: number },
  f: Fontes,
) {
  const dd: PDFDropdown = form.createDropdown(campo.chave);
  dd.addOptions([PLACEHOLDER_DROPDOWN, ...opcoes]);
  if (valor && opcoes.includes(valor)) dd.select(valor);
  else {
    if (valor) avisos.push(`${campo.chave}: valor fora das opções do PDF`);
    dd.select(PLACEHOLDER_DROPDOWN);
  }
  dd.addToPage(page, { ...ret, font: f.campo, backgroundColor: CAMPO, borderWidth: 0, textColor: TEXTO });
  dd.setFontSize(FONTE_CAMPO);
}

/** `Ficha_Cadastro_<Nome_Sobrenome>_<AAAA-MM-DD>.pdf` (data em São Paulo). */
export function nomeArquivoFicha(nome: string | null, data = new Date()): string {
  const partes = semAcento(nome ?? '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const curto = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes;
  const nomeArq = curto.map((p) => p[0].toUpperCase() + p.slice(1)).join('_') || 'Cliente';
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(data);
  return `Ficha_Cadastro_${nomeArq}_${dia}.pdf`;
}
