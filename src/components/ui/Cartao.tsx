import Link from 'next/link';

/** Caixa branca com borda fina; cabeçalho opcional com título em maiúsculas e ações à direita. */
export function Cartao({
  titulo,
  acoes,
  children,
  semPadding = false,
  className = '',
}: {
  titulo?: React.ReactNode;
  acoes?: React.ReactNode;
  children: React.ReactNode;
  semPadding?: boolean;
  className?: string;
}) {
  return (
    <section className={`rounded-sm border border-borda bg-white ${className}`}>
      {(titulo || acoes) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-4 py-3">
          {titulo && <h2 className="text-xs font-bold tracking-[0.08em] text-texto/70 uppercase">{titulo}</h2>}
          {acoes && <div className="flex flex-wrap items-center gap-3 text-sm">{acoes}</div>}
        </header>
      )}
      <div className={semPadding ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

/** Número de resumo (Visão geral): borda laranja à esquerda, número grande condensado e link. */
export function CartaoResumo({
  rotulo,
  valor,
  detalhe,
  href,
  alerta = false,
}: {
  rotulo: string;
  valor: React.ReactNode;
  detalhe: string;
  href?: string;
  alerta?: boolean;
}) {
  const corpo = (
    <>
      <span className="text-xs font-bold tracking-[0.08em] text-texto/70 uppercase">{rotulo}</span>
      <span className={`font-titulo text-4xl leading-none font-bold ${alerta ? 'text-red-600' : ''}`}>{valor}</span>
      <span className={`text-xs font-bold ${alerta ? 'text-red-600' : 'text-laranja-escuro'}`}>{detalhe}</span>
    </>
  );
  const classe = 'flex flex-col gap-3 rounded-sm border border-borda border-l-[3px] border-l-laranja bg-white px-4 py-4';
  return href ? (
    <Link href={href} className={`${classe} transition hover:border-texto/40 hover:border-l-laranja`}>
      {corpo}
    </Link>
  ) : (
    <div className={classe}>{corpo}</div>
  );
}

/** Classes das tabelas do painel (cabeçalho em maiúsculas, linhas com borda fina). */
export const TABELA = {
  tabela: 'w-full text-left text-sm',
  th: 'border-b border-borda px-4 py-3 text-xs font-bold tracking-[0.08em] text-texto/60 uppercase',
  tr: 'border-b border-borda/70 last:border-0 hover:bg-superficie/60',
  td: 'px-4 py-3',
  data: 'px-4 py-3 font-mono text-[13px] whitespace-nowrap',
};
