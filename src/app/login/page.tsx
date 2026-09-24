import type { Metadata } from 'next';
import { Marca } from '@/components/Marca';
import { FormLogin } from './FormLogin';

export const metadata: Metadata = { title: 'Entrar — LatForms' };

export default function PaginaLogin() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Marca titulo="LatForms" />
        <p className="mt-6 mb-8 text-sm text-texto/80">
          Área da equipe Latitudes. O acesso é criado pela administração; não há cadastro público.
        </p>
        <FormLogin />
      </div>
    </main>
  );
}
