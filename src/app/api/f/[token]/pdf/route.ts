import { registrarAuditoria } from '@/lib/audit';
import { SEM_CACHE, dentroDoLimiteCliente, naoEncontrado, validarTokenCliente } from '@/lib/ficha/acesso-cliente';
import { gerarFicha, nomeArquivoFicha } from '@/lib/ficha/pdf/gerar';
import { carregarRecursos } from '@/lib/ficha/pdf/recursos';
import { DadosFichaSchema } from '@/lib/ficha/schema';
import { proximoStatus } from '@/lib/ficha/status';
import { criarClienteAdmin } from '@/lib/supabase/admin';

/**
 * O cliente baixa a ficha (gerada na hora a partir dos dados da ficha). Só o download marca "aberta":
 * abrir a página não conta (pré-visualizações de link também abrem a URL).
 */
export async function GET(_req: Request, ctx: RouteContext<'/api/f/[token]/pdf'>) {
  if (!(await dentroDoLimiteCliente())) {
    return Response.json({ ok: false, erro: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429, headers: SEM_CACHE });
  }
  const { token } = await ctx.params;
  const acesso = await validarTokenCliente(token);
  if (!acesso) return naoEncontrado();

  const dados = DadosFichaSchema.safeParse(acesso.ficha.dadosSnapshot);
  if (!dados.success) return naoEncontrado();

  try {
    const { pdf } = await gerarFicha(dados.data, await carregarRecursos());

    const novo = proximoStatus(acesso.ficha.status, 'baixar_pdf');
    if (novo && novo !== acesso.ficha.status) {
      await criarClienteAdmin().from('fichas').update({ status: novo }).eq('id', acesso.ficha.id).eq('status', acesso.ficha.status);
    }
    await registrarAuditoria({ ator: `cliente:${acesso.ficha.id}`, acao: 'cliente_baixou_pdf', fichaId: acesso.ficha.id });

    return new Response(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), {
      headers: {
        ...SEM_CACHE,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeArquivoFicha(acesso.cliente.nome)}"`,
      },
    });
  } catch (e) {
    console.error('f/pdf: falha ao gerar', { fichaId: acesso.ficha.id, erro: (e as Error).name });
    return Response.json({ ok: false, erro: 'Não foi possível gerar a ficha agora. Tente de novo.' }, { status: 500, headers: SEM_CACHE });
  }
}
