import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Marca } from '@/components/Marca';
import { dentroDoLimiteIp, validarTokenCliente } from '@/lib/ficha/acesso-cliente';
import { primeiroNome } from '@/lib/rd/extrair';

export const metadata: Metadata = { title: 'Ficha de Cadastro — Latitudes', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// TODO(v3, Fase 5): a ficha editável com autosave entra aqui.
export default async function PaginaCliente({ params }: PageProps<'/f/[token]'>) {
  const { token } = await params;
  if (!(await dentroDoLimiteIp())) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
        <Marca titulo="Ficha de cadastro" />
        <p>Muitas tentativas em pouco tempo. Aguarde um minuto e recarregue a página.</p>
      </main>
    );
  }
  const acesso = await validarTokenCliente(token, { registrarUso: true });
  if (!acesso) notFound();
  const nome = primeiroNome(acesso.cliente.nome);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <Marca titulo="Ficha de cadastro" />
      <h1 className="text-xl font-bold">Olá{nome ? `, ${nome}` : ''}!</h1>
      <p>A sua Ficha de Cadastro Latitudes estará disponível aqui em instantes.</p>
    </main>
  );
}
