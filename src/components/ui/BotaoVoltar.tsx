'use client';

import { useRouter } from 'next/navigation';

// páginas do painel abertas nesta aba (a navegação do Next não muda document.referrer)
let paginasNoPainel = 0;
let ultimaPagina: string | null = null;
export function registrarPaginaNoPainel(caminho: string) {
  if (caminho === ultimaPagina) return; // o efeito pode rodar 2x (StrictMode) para a mesma página
  ultimaPagina = caminho;
  paginasNoPainel++;
}

/**
 * Seta "voltar": volta para a página anterior do painel (como o botão do navegador). Se a página foi aberta
 * direto (sem página anterior do LatForms), vai para `href`.
 */
export function BotaoVoltar({ href, rotulo }: { href: string; rotulo: string }) {
  const router = useRouter();
  return (
    <a
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // abrir em nova aba continua funcionando
        e.preventDefault();
        // só volta no histórico se a página anterior é do painel (nunca para o login ou outro site)
        if (paginasNoPainel > 1) router.back();
        else router.push(href);
      }}
      aria-label={rotulo}
      title={rotulo}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-borda bg-white text-texto/70 hover:border-texto/40 hover:text-texto"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
        <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
      </svg>
    </a>
  );
}
