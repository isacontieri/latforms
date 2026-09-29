import { registrarAuditoria } from '@/lib/audit';
import { SEM_CACHE, dentroDoLimiteIp, muitasTentativas, naoEncontrado, respostaCliente, validarTokenCliente } from '@/lib/ficha/acesso-cliente';
import { gerarFicha, nomeArquivoFicha } from '@/lib/ficha/pdf/gerar';
import { carregarRecursos } from '@/lib/ficha/pdf/recursos';
import { DadosFichaSchema } from '@/lib/ficha/schema';

/** Cópia em PDF para o cliente, só depois de concluir a ficha (gerada na hora a partir de dados_atuais). */
export async function GET(_req: Request, ctx: RouteContext<'/api/f/[token]/pdf'>) {
  if (!(await dentroDoLimiteIp())) return muitasTentativas();
  const { token } = await ctx.params;
  const acesso = await validarTokenCliente(token);
  if (!acesso) return naoEncontrado();
  if (acesso.ficha.status !== 'concluida' && acesso.ficha.status !== 'aprovada') {
    return respostaCliente({ ok: false, erro: 'A cópia em PDF fica disponível depois que você concluir a ficha.' }, 409);
  }

  const dados = DadosFichaSchema.safeParse(acesso.ficha.dadosAtuais);
  if (!dados.success) return naoEncontrado();

  try {
    const { pdf } = await gerarFicha(dados.data, await carregarRecursos());
    await registrarAuditoria({ ator: `cliente:${acesso.ficha.id}`, acao: 'cliente_baixou_copia_pdf', fichaId: acesso.ficha.id });
    return new Response(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), {
      headers: {
        ...SEM_CACHE,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeArquivoFicha(acesso.cliente.nome)}"`,
      },
    });
  } catch (e) {
    console.error('f/pdf: falha ao gerar', { fichaId: acesso.ficha.id, erro: (e as Error).name });
    return respostaCliente({ ok: false, erro: 'Não foi possível gerar o PDF agora. Tente de novo.' }, 500);
  }
}
