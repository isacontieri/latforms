import Link from "next/link";
import { sair } from "@/app/login/actions";
import { BotaoVoltar } from "./BotaoVoltar";

/** Cabeçalho das páginas do painel (seção em maiúsculas + título condensado) e área de conteúdo. */
export function Pagina({
  secao,
  voltar,
  titulo,
  descricao,
  acoes,
  children,
}: {
  secao: string;
  voltar?: { href: string; rotulo: string };
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-borda bg-white px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          {voltar && <BotaoVoltar href={voltar.href} rotulo="Voltar" />}
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] tracking-[0.14em] text-texto/50 uppercase">
              {voltar ? (
                <>
                  <Link href={voltar.href} className="hover:text-laranja">
                    {secao}
                  </Link>
                  {" / "}
                  {voltar.rotulo}
                </>
              ) : (
                secao
              )}
            </span>
            <h1 className="font-titulo text-3xl leading-tight font-bold break-words">
              {titulo}
            </h1>
            {descricao && (
              <p className="max-w-3xl text-sm text-texto/70">{descricao}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {acoes}
          <form action={sair}>
            <button
              type="submit"
              className="h-9 rounded-sm border border-borda bg-white px-3 text-sm font-bold hover:border-texto/40"
            >
              Sair
            </button>
          </form>
        </div>
      </header>
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">{children}</div>
    </>
  );
}
