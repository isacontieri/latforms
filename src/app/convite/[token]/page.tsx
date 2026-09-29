import type { Metadata } from 'next';
import { CartaoAcesso } from '@/components/ui/CartaoAcesso';
import { buscarConviteValido } from '@/lib/equipe/convites';
import { FormConvite } from './FormConvite';

export const metadata: Metadata = { title: 'Acesso à equipe — LatForms', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Abrir a página não usa o link (pré-visualizações de mensagem também abrem a URL); só o envio do formulário. */
export default async function PaginaConvite({ params }: PageProps<'/convite/[token]'>) {
  const { token } = await params;
  const convite = await buscarConviteValido(token);

  return (
    <CartaoAcesso>
      <div>
        {!convite ? (
          <div className="flex flex-col gap-2">
            <h1 className="text-lg font-bold">Link inválido ou expirado</h1>
            <p className="text-sm">Peça um novo link a alguém da equipe Latitudes.</p>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-bold">
              {convite.tipo === 'convite' ? 'Crie seu acesso à equipe' : 'Defina uma nova senha'}
            </h1>
            <p className="mt-1 mb-6 text-sm text-texto/80">
              {convite.tipo === 'convite'
                ? 'Você foi convidada(o) para o LatForms, o sistema de fichas da Latitudes.'
                : 'Este link vale uma vez. Depois de salvar, entre com a senha nova.'}
            </p>
            <FormConvite token={token} tipo={convite.tipo} email={convite.email} nomeSugerido={convite.nome} />
          </>
        )}
      </div>
    </CartaoAcesso>
  );
}
