import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { verificarConsultora } from '@/lib/auth';
import { ImportarCsv } from './ImportarCsv';

export const metadata: Metadata = { title: 'Importar CSV — LatForms' };

export default async function PaginaImportar() {
  const auth = await verificarConsultora();
  if (!auth.ok) redirect('/login');

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-laranja">Importar CSV do RD Station</h1>
        <p className="text-sm">
          Primeiro o sistema mostra uma prévia; nada é gravado até você confirmar. Contatos que já existem (mesmo ID do RD)
          são atualizados, sem duplicar e sem mexer nas fichas já geradas.
        </p>
      </div>
      <ImportarCsv />
    </section>
  );
}
