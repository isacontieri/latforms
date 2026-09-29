import { ROTULO_STATUS, type StatusFicha } from '@/lib/ficha/status';

const COR: Record<StatusFicha, string> = {
  gerada: 'bg-slate-100 text-slate-600',
  enviada: 'bg-sky-50 text-sky-700',
  aberta: 'bg-indigo-50 text-indigo-700',
  em_preenchimento: 'bg-orange-50 text-orange-700',
  concluida: 'bg-emerald-50 text-emerald-700',
  aprovada: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-red-50 text-red-700',
};

const CURTO: Partial<Record<StatusFicha, string>> = { concluida: 'Concluída' };

/** Selo colorido de situação da ficha (tabelas e painel). */
export function SeloStatus({ status, curto = false }: { status: StatusFicha; curto?: boolean }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap uppercase ${COR[status]}`} data-status={status}>
      {curto ? (CURTO[status] ?? ROTULO_STATUS[status]) : ROTULO_STATUS[status]}
    </span>
  );
}
