import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Fichas — LatForms' };

export default function PaginaAdmin() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-xl font-bold text-laranja">Fichas</h1>
      <p className="text-sm">A lista de fichas e a importação do CSV entram nas próximas fases.</p>
    </section>
  );
}
