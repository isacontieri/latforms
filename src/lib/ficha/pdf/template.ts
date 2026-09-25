import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
let cache: Promise<Uint8Array> | null = null;

/** Template lido do repositório uma vez por instância (incluído no deploy via outputFileTracingIncludes). */
export function carregarTemplate(): Promise<Uint8Array> {
  // caminho literal (não CAMINHO_TEMPLATE): com variável, o Turbopack inclui o projeto inteiro no deploy
  cache ??= readFile(path.join(process.cwd(), 'assets', 'templates', 'ficha-cadastro-2024.pdf')).then(
    (b) => new Uint8Array(b),
  );
  cache.catch(() => (cache = null));
  return cache;
}
