import { Marca } from '@/components/Marca';

/** Resposta genérica para token inexistente, expirado, revogado ou de ficha cancelada (sempre 404). */
export default function LinkInvalido() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <Marca titulo="Ficha de cadastro" />
      <h1 className="text-xl font-bold">Link inválido ou expirado</h1>
      <p>Este link não está mais disponível. Fale com a equipe Latitudes para receber um novo.</p>
    </main>
  );
}
