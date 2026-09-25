import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RecursosFicha } from './gerar';

let cache: Promise<RecursosFicha> | null = null;

// Caminhos literais: com variável, o Turbopack inclui o projeto inteiro no deploy.
// next.config.ts inclui assets/fonts e assets/templates via outputFileTracingIncludes.
async function ler(): Promise<RecursosFicha> {
  const [fonteRegular, fonteNegrito, fonteItalico, logoPng] = await Promise.all([
    readFile(path.join(process.cwd(), 'assets', 'fonts', 'OpenSans-Regular.ttf')),
    readFile(path.join(process.cwd(), 'assets', 'fonts', 'OpenSans-Bold.ttf')),
    readFile(path.join(process.cwd(), 'assets', 'fonts', 'OpenSans-Italic.ttf')),
    readFile(path.join(process.cwd(), 'assets', 'templates', 'logo-latitudes.png')),
  ]);
  return {
    fonteRegular: new Uint8Array(fonteRegular),
    fonteNegrito: new Uint8Array(fonteNegrito),
    fonteItalico: new Uint8Array(fonteItalico),
    logoPng: new Uint8Array(logoPng),
  };
}

/** Fontes Open Sans (OFL) e logo, lidos uma vez por instância. */
export function carregarRecursos(): Promise<RecursosFicha> {
  cache ??= ler();
  cache.catch(() => (cache = null));
  return cache;
}
