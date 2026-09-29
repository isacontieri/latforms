import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Cartao } from '@/components/ui/Cartao';
import { Pagina } from '@/components/ui/Pagina';
import { verificarConsultora } from '@/lib/auth';
import { ImportarCsv } from './ImportarCsv';

export const metadata: Metadata = { title: 'Importar CSV — LatForms' };

export default async function PaginaImportar() {
  const auth = await verificarConsultora();
  if (!auth.ok) redirect('/login');

  return (
    <Pagina
      secao="Fichas"
      titulo="Importar CSV do RD Station"
      descricao="Primeiro o sistema mostra uma prévia; nada é gravado até você confirmar. Contatos que já existem (mesmo ID do RD) são atualizados, sem duplicar."
    >
      <Cartao>
        <ImportarCsv />
      </Cartao>
    </Pagina>
  );
}
