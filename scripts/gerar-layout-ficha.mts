/**
 * Gera o layout da ficha web a partir do gerador do PDF (fonte única do desenho):
 *   - src/lib/ficha/ficha-layout.json  (posição de cada campo, em % da página)
 *   - public/ficha/pagina-<n>.webp     (fundo de cada página, sem os campos, 144 dpi)
 *
 * Uso: npm run ficha:layout   (precisa de Python com `pip install pymupdf pillow` — só em desenvolvimento)
 * Rode sempre que mudar campos.ts ou o desenho em pdf/gerar.ts; o teste layout.test.ts acusa se esquecer.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { montarLayout } from '../src/lib/ficha/layout-gerar';
import { MODELO_FICHA, gerarFicha, type RecursosFicha } from '../src/lib/ficha/pdf/gerar';
import { CAMPOS_FICHA } from '../src/lib/ficha/campos';
import type { DadosFicha } from '../src/lib/ficha/schema';
import { PDFDocument } from 'pdf-lib';

const raiz = path.resolve(import.meta.dirname, '..');
const ler = (...p: string[]) => new Uint8Array(readFileSync(path.join(raiz, ...p)));
const recursos: RecursosFicha = {
  fonteRegular: ler('assets', 'fonts', 'OpenSans-Regular.ttf'),
  fonteNegrito: ler('assets', 'fonts', 'OpenSans-Bold.ttf'),
  fonteItalico: ler('assets', 'fonts', 'OpenSans-Italic.ttf'),
  logoPng: ler('assets', 'templates', 'logo-latitudes.png'),
};
const vazia = Object.fromEntries(CAMPOS_FICHA.map((c) => [c.chave, null])) as DadosFicha;

const { pdf, posicoes } = await gerarFicha(vazia, recursos, { semCampos: true });
const paginas = (await PDFDocument.load(pdf)).getPageCount();
const layout = montarLayout(posicoes, paginas, MODELO_FICHA);
writeFileSync(path.join(raiz, 'src', 'lib', 'ficha', 'ficha-layout.json'), `${JSON.stringify(layout, null, 2)}\n`);
console.log(`ficha-layout.json: ${layout.campos.length} campos em ${paginas} páginas`);

const tmp = mkdtempSync(path.join(tmpdir(), 'latforms-fundo-'));
try {
  const arquivoPdf = path.join(tmp, 'fundo.pdf');
  writeFileSync(arquivoPdf, pdf);
  const destino = path.join(raiz, 'public', 'ficha');
  for (const f of readdirSync(destino)) if (/^pagina-\d+\.webp$/.test(f)) rmSync(path.join(destino, f));
  const python = process.env.PYTHON ?? 'python';
  const r = spawnSync(python, [path.join(raiz, 'scripts', 'renderizar-fundo-ficha.py'), arquivoPdf, destino], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('falha ao renderizar os fundos (instale: pip install pymupdf pillow, ou defina PYTHON)');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
