'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icone, type NomeIcone } from './Icone';

const SECOES: { titulo: string; itens: { href: string; rotulo: string; icone: NomeIcone; exato?: boolean }[] }[] = [
  {
    titulo: 'Fichas',
    itens: [
      { href: '/admin', rotulo: 'Visão geral', icone: 'visao', exato: true },
      { href: '/admin/clientes', rotulo: 'Clientes', icone: 'clientes' },
      { href: '/admin/importar', rotulo: 'Importar CSV', icone: 'importar' },
    ],
  },
  { titulo: 'Administração', itens: [{ href: '/admin/equipe', rotulo: 'Equipe', icone: 'equipe' }] },
];

/** Navegação da barra lateral; a ficha ao vivo conta como "Clientes". */
export function NavLateral() {
  const caminho = usePathname();
  const ativo = (href: string, exato?: boolean) =>
    exato ? caminho === href : caminho.startsWith(href) || (href === '/admin/clientes' && caminho.startsWith('/admin/fichas'));

  return (
    <nav className="flex gap-6 overflow-x-auto lg:flex-col lg:gap-5 lg:overflow-visible" aria-label="Menu">
      {SECOES.map((s) => (
        <div key={s.titulo} className="flex shrink-0 flex-col gap-1">
          <span className="hidden px-2 text-[11px] font-bold tracking-[0.14em] text-painel-apagado uppercase lg:block">{s.titulo}</span>
          <ul className="flex gap-1 lg:flex-col">
            {s.itens.map((i) => {
              const a = ativo(i.href, i.exato);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={a ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-sm border-l-2 px-3 py-2 text-sm whitespace-nowrap transition ${
                      a ? 'border-laranja bg-[#3b2f27] font-bold text-white' : 'border-transparent text-painel-texto hover:bg-painel-claro hover:text-white'
                    }`}
                  >
                    <Icone nome={i.icone} />
                    {i.rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
