import { z } from 'zod';
import { registrarAuditoria } from '@/lib/audit';
import { SEM_CACHE, dentroDoLimiteCliente, naoEncontrado, validarTokenCliente } from '@/lib/ficha/acesso-cliente';
import { TAMANHO_MAXIMO, validarPdfDevolvido } from '@/lib/ficha/pdf/validar';
import { proximoStatus } from '@/lib/ficha/status';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/database.types';

const ConfirmarSchema = z.object({ path: z.string().min(1).max(200) });
const BUCKET = 'fichas-respondidas';
const resposta = (corpo: object, status = 200) => Response.json(corpo, { status, headers: SEM_CACHE });

/**
 * O navegador avisa que terminou o envio: o servidor baixa o arquivo do Storage, valida (skill §7) e,
 * se estiver certo, grava a versão do cliente e muda a ficha para "respondida". Arquivo inválido é apagado.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/f/[token]/confirmar'>) {
  if (!(await dentroDoLimiteCliente())) return resposta({ ok: false, erro: 'Muitas tentativas. Aguarde um minuto.' }, 429);
  const { token } = await ctx.params;
  const acesso = await validarTokenCliente(token);
  if (!acesso) return naoEncontrado();

  let corpo: z.infer<typeof ConfirmarSchema>;
  try {
    corpo = ConfirmarSchema.parse(await req.json());
  } catch {
    return resposta({ ok: false, erro: 'Requisição inválida' }, 400);
  }

  const { ficha } = acesso;
  // o caminho precisa ser desta ficha, no formato que a upload-url gera (sem "..", sem outra pasta)
  if (!new RegExp(`^${ficha.id}/\\d{10,16}\\.pdf$`).test(corpo.path)) return resposta({ ok: false, erro: 'Arquivo não pertence a esta ficha' }, 403);

  const novoStatus = proximoStatus(ficha.status, 'upload_valido');
  const storage = criarClienteAdmin().storage.from(BUCKET);
  const apagar = () => storage.remove([corpo.path]);
  if (!novoStatus) {
    await apagar();
    return resposta({ ok: false, erro: 'Esta ficha já foi aprovada e não aceita novos envios.' }, 409);
  }

  const { data: arquivo, error } = await storage.download(corpo.path);
  if (error || !arquivo) return resposta({ ok: false, erro: 'Não encontramos o arquivo enviado. Envie de novo.' }, 404);
  if (arquivo.size > TAMANHO_MAXIMO) {
    await apagar();
    return resposta({ ok: false, erro: 'O arquivo passa de 5 MB. Envie o PDF da ficha que você baixou aqui.' }, 422);
  }

  const validacao = await validarPdfDevolvido(new Uint8Array(await arquivo.arrayBuffer()));
  if (!validacao.ok) {
    await apagar();
    await registrarAuditoria({ ator: `cliente:${ficha.id}`, acao: `envio_recusado:${validacao.motivo}`, fichaId: ficha.id });
    return resposta({ ok: false, erro: validacao.mensagem }, 422);
  }

  const { data: atualizada } = await criarClienteAdmin()
    .from('fichas')
    .update({
      status: novoStatus,
      dados_respondidos: validacao.dados as unknown as Json,
      pdf_respondido_path: corpo.path,
      respondida_em: new Date().toISOString(),
      motivo_correcao: null,
    })
    .eq('id', ficha.id)
    .eq('status', ficha.status) // se o status mudou nesse meio-tempo (ex.: aprovada), não sobrescreve
    .select('id');
  if (!atualizada?.length) {
    await apagar();
    return resposta({ ok: false, erro: 'A situação da ficha mudou. Recarregue a página.' }, 409);
  }

  // novo envio substitui o anterior: apagar o arquivo antigo economiza Storage
  if (ficha.pdfRespondidoPath && ficha.pdfRespondidoPath !== corpo.path) await storage.remove([ficha.pdfRespondidoPath]);

  await registrarAuditoria({ ator: `cliente:${ficha.id}`, acao: 'cliente_enviou_ficha', fichaId: ficha.id });
  return resposta({ ok: true, data: { status: novoStatus } });
}
