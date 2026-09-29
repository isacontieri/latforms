import { registrarAuditoria } from '@/lib/audit';
import { exigirConsultora } from '@/lib/auth';
import { falha, lerCorpo, ok } from '@/lib/http';
import { NovaImportacaoSchema } from '@/lib/importacao/lote';
import { criarClienteServidor } from '@/lib/supabase/server';

/** Abre o registro de uma importação confirmada. As linhas chegam depois, em lotes. */
export async function POST(req: Request) {
  const consultora = await exigirConsultora();
  if (consultora instanceof Response) return consultora;

  const corpo = await lerCorpo(req, NovaImportacaoSchema);
  if (corpo instanceof Response) return corpo;

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from('importacoes')
    .insert({ arquivo_nome: corpo.arquivoNome, total_linhas: corpo.totalLinhas, importado_por: consultora.id })
    .select('id')
    .single();
  if (error) {
    console.error('importacoes: criar', error.code);
    return falha('Não foi possível iniciar a importação', 500);
  }

  await registrarAuditoria({ ator: `consultora:${consultora.id}`, acao: `importacao_iniciada:${data.id}` });
  return ok({ id: data.id }, { status: 201 });
}
