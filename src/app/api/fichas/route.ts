import { z } from 'zod';
import { registrarAuditoria } from '@/lib/audit';
import { exigirFuncionario } from '@/lib/auth';
import { mapearParaFicha } from '@/lib/ficha/mapping';
import type { DadosRd } from '@/lib/rd/extrair';
import { falha, lerCorpo, ok } from '@/lib/http';
import { criarClienteServidor } from '@/lib/supabase/server';

const CriarFichaSchema = z.object({ clienteId: z.uuid() });

/** Cria uma ficha (status "gerada") com a foto dos dados atuais do cliente. O PDF é gerado sob demanda. */
export async function POST(req: Request) {
  const funcionario = await exigirFuncionario();
  if (funcionario instanceof Response) return funcionario;

  const corpo = await lerCorpo(req, CriarFichaSchema);
  if (corpo instanceof Response) return corpo;

  const supabase = await criarClienteServidor();
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, dados_rd, fichas(versao)')
    .eq('id', corpo.clienteId)
    .maybeSingle();
  if (!cliente) return falha('Cliente não encontrado', 404);

  const campos = (cliente.dados_rd as unknown as DadosRd | null)?.campos;
  if (!campos) return falha('Os dados do RD deste cliente estão incompletos; reimporte o CSV', 422);
  const snapshot = mapearParaFicha(campos);

  const versao = Math.max(0, ...cliente.fichas.map((f) => f.versao)) + 1;
  const { data: ficha, error } = await supabase
    .from('fichas')
    .insert({ cliente_id: cliente.id, versao, dados_snapshot: snapshot, criado_por: funcionario.id })
    .select('id, versao, status')
    .single();
  if (error) {
    console.error('fichas: criar', error.code);
    return falha('Não foi possível criar a ficha', 500);
  }

  await registrarAuditoria({ ator: `funcionario:${funcionario.id}`, acao: 'ficha_criada', fichaId: ficha.id });
  return ok(ficha, { status: 201 });
}
