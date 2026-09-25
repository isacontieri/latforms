import { SEM_CACHE, dentroDoLimiteCliente, naoEncontrado, validarTokenCliente } from '@/lib/ficha/acesso-cliente';
import { proximoStatus } from '@/lib/ficha/status';
import { criarClienteAdmin } from '@/lib/supabase/admin';

/**
 * URL assinada para o navegador do cliente enviar o PDF DIRETO ao Supabase Storage (nada passa pela Vercel).
 * Caminho novo e único por envio, sem sobrescrever; o arquivo só vale depois de /confirmar.
 */
export async function POST(_req: Request, ctx: RouteContext<'/api/f/[token]/upload-url'>) {
  if (!(await dentroDoLimiteCliente())) {
    return Response.json({ ok: false, erro: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429, headers: SEM_CACHE });
  }
  const { token } = await ctx.params;
  const acesso = await validarTokenCliente(token);
  if (!acesso) return naoEncontrado();

  if (!proximoStatus(acesso.ficha.status, 'upload_valido')) {
    return Response.json({ ok: false, erro: 'Esta ficha já foi aprovada e não aceita novos envios.' }, { status: 409, headers: SEM_CACHE });
  }

  const caminho = `${acesso.ficha.id}/${Date.now()}.pdf`;
  const { data, error } = await criarClienteAdmin().storage.from('fichas-respondidas').createSignedUploadUrl(caminho);
  if (error || !data) {
    console.error('f/upload-url', { fichaId: acesso.ficha.id, erro: error?.name });
    return Response.json({ ok: false, erro: 'Não foi possível preparar o envio. Tente de novo.' }, { status: 500, headers: SEM_CACHE });
  }
  return Response.json({ ok: true, data: { path: data.path, token: data.token } }, { headers: SEM_CACHE });
}
