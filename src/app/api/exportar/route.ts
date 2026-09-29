import { registrarAuditoria } from '@/lib/audit';
import { exigirConsultora } from '@/lib/auth';
import { montarCsv, STATUS_EXPORTAVEIS } from '@/lib/ficha/exportar';
import type { StatusFicha } from '@/lib/ficha/status';
import { falha } from '@/lib/http';
import { criarClienteServidor } from '@/lib/supabase/server';

const LIMITE = 2000;

/** Exporta as fichas de um status (padrão: concluídas) em CSV, gerado na hora e não guardado. */
export async function GET(req: Request) {
  const consultora = await exigirConsultora();
  if (consultora instanceof Response) return consultora;

  const status = (new URL(req.url).searchParams.get('status') ?? 'concluida') as StatusFicha;
  if (!STATUS_EXPORTAVEIS.includes(status)) return falha('Status inválido para exportação', 400);

  const { data, error } = await (await criarClienteServidor())
    .from('fichas')
    .select('id, status, dados_atuais, concluida_em, atualizado_em, clientes(rd_id)')
    .eq('status', status)
    .order('atualizado_em', { ascending: false })
    .limit(LIMITE);
  if (error) {
    console.error('exportar: consulta', error.code);
    return falha('Não foi possível exportar', 500);
  }

  const csv = montarCsv(
    data.map((f) => ({
      rdId: f.clientes?.rd_id ?? '',
      status: f.status,
      concluidaEm: f.concluida_em,
      atualizadoEm: f.atualizado_em,
      dados: (f.dados_atuais ?? {}) as Record<string, unknown>,
    })),
  );
  await registrarAuditoria({ ator: `consultora:${consultora.id}`, acao: `fichas_exportadas:${status}:${data.length}` });

  const dia = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="fichas-${status}-${dia}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
