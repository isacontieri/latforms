import 'server-only';
import type { criarClienteServidor } from '@/lib/supabase/server';
import { avisosDeDuplicidade, type ClienteExistente, type DocContato, type ResultadoLinha } from './lote';

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

/** Busca os clientes que já existem (por rd_id) com a ficha ativa (não cancelada) de cada um. */
export async function buscarExistentes(supabase: Supabase, rdIds: string[]): Promise<Map<string, ClienteExistente>> {
  const mapa = new Map<string, ClienteExistente>();
  if (rdIds.length === 0) return mapa;

  const { data, error } = await supabase
    .from('clientes')
    .select('id, rd_id, fichas(id, status, dados_originais)')
    .in('rd_id', rdIds)
    .neq('fichas.status', 'cancelada');
  if (error) throw new Error(`buscar clientes existentes: ${error.code}`);

  for (const c of data ?? []) {
    const f = c.fichas[0]; // índice único: no máximo uma ficha ativa por cliente
    mapa.set(c.rd_id, {
      id: c.id,
      ficha: f ? { id: f.id, status: f.status, originais: f.dados_originais } : null,
    });
  }
  return mapa;
}

const aspas = (v: string) => `"${v.replace(/["\\]/g, '')}"`;

/**
 * Acrescenta aos resultados o aviso de possível duplicado contra clientes já cadastrados
 * (mesmo CPF ou e-mail com outro ID do RD). A comparação dentro do arquivo inteiro é feita no navegador.
 */
export async function anexarAvisosDeDuplicidade(supabase: Supabase, documentos: DocContato[], resultados: ResultadoLinha[]) {
  const cpfs = [...new Set(documentos.map((d) => d.cpf).filter((x): x is string => !!x))];
  const emails = [...new Set(documentos.map((d) => d.email).filter((x): x is string => !!x))];
  if (cpfs.length === 0 && emails.length === 0) return;

  const filtros = [
    emails.length ? `email.in.(${emails.map(aspas).join(',')})` : null,
    cpfs.length ? `dados_rd->campos->>cpf.in.(${cpfs.map(aspas).join(',')})` : null,
  ].filter(Boolean).join(',');
  const { data, error } = await supabase.from('clientes').select('rd_id, nome, email, cpf:dados_rd->campos->>cpf').or(filtros);
  if (error) {
    console.error('importacao: busca de duplicados', error.code);
    return;
  }
  const cadastrados: DocContato[] = (data ?? []).map((c) => ({
    rdId: c.rd_id, nome: c.nome, email: c.email, cpf: (c.cpf as string | null) ?? null,
  }));
  const avisos = avisosDeDuplicidade(documentos, cadastrados, false);
  for (const r of resultados) r.avisos.push(...(avisos.get(r.indice) ?? []));
}
