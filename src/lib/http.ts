import type { z } from 'zod';

/** Convenção das rotas: `{ ok: true, data } | { ok: false, erro }`. */
export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data }, init);
}

export function falha(erro: string, status: number): Response {
  return Response.json({ ok: false, erro }, { status });
}

/** Lê e valida o corpo JSON. Devolve os dados ou a resposta 400 pronta. */
export async function lerCorpo<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | Response> {
  let bruto: unknown;
  try {
    bruto = await req.json();
  } catch {
    return falha('Corpo da requisição não é JSON válido', 400);
  }
  const r = schema.safeParse(bruto);
  return r.success ? r.data : falha('Dados inválidos na requisição', 400);
}
