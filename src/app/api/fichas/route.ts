import { z } from 'zod';
import { registrarAuditoria } from '@/lib/audit';
import { exigirConsultora } from '@/lib/auth';
import { atualizarFichaPeloRd } from '@/lib/ficha/atualizar';
import { mapearParaFicha } from '@/lib/ficha/mapping';
import { aceitaDadosDoRd } from '@/lib/ficha/status';
import { falha, lerCorpo, ok } from '@/lib/http';
import { jsonIgual } from '@/lib/importacao/lote';
import type { DadosRd } from '@/lib/rd/extrair';
import type { Json } from '@/lib/supabase/database.types';
import { criarClienteServidor } from '@/lib/supabase/server';

const GerarFichaSchema = z.object({ clienteId: z.uuid() });

/**
 * Gera ou atualiza a ficha do cliente — sempre UMA por cliente, nunca duplica.
 * - sem ficha: cria com dados_originais = dados_atuais = dados do RD;
 * - cliente ainda não editou nada: atualiza com o RD atual (o link continua o mesmo);
 * - cliente já editou: não altera (409); o RD atual aparece no painel para comparação.
 */
export async function POST(req: Request) {
  const consultora = await exigirConsultora();
  if (consultora instanceof Response) return consultora;

  const corpo = await lerCorpo(req, GerarFichaSchema);
  if (corpo instanceof Response) return corpo;

  const supabase = await criarClienteServidor();
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, dados_rd, fichas(id, status, dados_originais)')
    .eq('id', corpo.clienteId)
    .neq('fichas.status', 'cancelada')
    .maybeSingle();
  if (!cliente) return falha('Cliente não encontrado', 404);

  const campos = (cliente.dados_rd as unknown as DadosRd | null)?.campos;
  if (!campos) return falha('Os dados do RD deste cliente estão incompletos; reimporte o CSV', 422);
  const dados = mapearParaFicha(campos);
  const ator = `consultora:${consultora.id}`;
  const ativa = cliente.fichas[0];

  if (ativa) {
    if (!aceitaDadosDoRd(ativa.status)) {
      return falha('O cliente já começou a preencher a ficha; ela não é mais atualizada pelo RD.', 409);
    }
    if (jsonIgual(ativa.dados_originais, dados)) return ok({ id: ativa.id, status: ativa.status, acao: 'sem_mudanca' });
    const atualizou = await atualizarFichaPeloRd(supabase, { fichaId: ativa.id, dados }, ator);
    if (!atualizou) return falha('O cliente começou a preencher a ficha agora há pouco; ela não foi alterada.', 409);
    return ok({ id: ativa.id, status: ativa.status, acao: 'atualizada' });
  }

  const json = dados as unknown as Json;
  const { data: ficha, error } = await supabase
    .from('fichas')
    .insert({ cliente_id: cliente.id, dados_originais: json, dados_atuais: json, criado_por: consultora.id })
    .select('id, status')
    .single();
  if (error) {
    // 23505 = outra requisição criou a ficha ao mesmo tempo (índice de uma ficha ativa por cliente)
    if (error.code === '23505') return falha('A ficha deste cliente acabou de ser criada. Recarregue a página.', 409);
    console.error('fichas: criar', error.code);
    return falha('Não foi possível criar a ficha', 500);
  }

  await registrarAuditoria({ ator, acao: 'ficha_criada', fichaId: ficha.id });
  return ok({ ...ficha, acao: 'criada' }, { status: 201 });
}
