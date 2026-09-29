import { exigirConsultora } from '@/lib/auth';
import { falha, lerCorpo, ok } from '@/lib/http';
import { PreviaSchema, planejarLote } from '@/lib/importacao/lote';
import { anexarAvisosDeDuplicidade, buscarExistentes } from '@/lib/importacao/servidor';
import { extrairLinha } from '@/lib/rd/extrair';
import { criarClienteServidor } from '@/lib/supabase/server';

/** Prévia de um lote: diz o que aconteceria com cada linha, sem gravar nada. */
export async function POST(req: Request) {
  const consultora = await exigirConsultora();
  if (consultora instanceof Response) return consultora;

  const corpo = await lerCorpo(req, PreviaSchema);
  if (corpo instanceof Response) return corpo;

  try {
    const supabase = await criarClienteServidor();
    const rdIds = corpo.linhas.map((l) => extrairLinha(l).rdId).filter((id): id is string => id !== null);
    const existentes = await buscarExistentes(supabase, [...new Set(rdIds)]);
    const { resultados, documentos } = planejarLote(corpo.linhas, corpo.inicio, existentes);
    await anexarAvisosDeDuplicidade(supabase, documentos, resultados);
    return ok({ resultados });
  } catch (e) {
    console.error('importacao/previa', (e as Error).message);
    return falha('Não foi possível analisar o arquivo', 500);
  }
}
