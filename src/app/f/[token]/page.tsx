import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Marca } from '@/components/Marca';
import { dentroDoLimiteIp, validarTokenCliente } from '@/lib/ficha/acesso-cliente';
import { DadosFichaSchema } from '@/lib/ficha/schema';
import { clienteVerificado } from '@/lib/ficha/verificacao';
import { primeiroNome } from '@/lib/rd/extrair';
import { FichaCliente } from './FichaCliente';
import { FormVerificacao } from './FormVerificacao';

export const metadata: Metadata = { title: 'Ficha de Cadastro — Latitudes', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const formatarData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });

function Pagina({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-[940px] flex-1 flex-col gap-6 px-4 py-8">{children}</main>;
}

/**
 * Ficha do cliente (sem login). Abrir a página NÃO muda o status: o 1º sinal de presença do navegador marca "aberta".
 * Os dados da ficha só vão para o HTML depois do token (e, se ligada, da verificação da data de nascimento).
 */
export default async function PaginaCliente({ params }: PageProps<'/f/[token]'>) {
  const { token } = await params;
  if (!(await dentroDoLimiteIp())) {
    return (
      <Pagina>
        <Marca titulo="Ficha de cadastro" />
        <p>Muitas tentativas em pouco tempo. Aguarde um minuto e recarregue a página.</p>
      </Pagina>
    );
  }

  const acesso = await validarTokenCliente(token, { registrarUso: true });
  if (!acesso) notFound();
  const nome = primeiroNome(acesso.cliente.nome);

  if (!(await clienteVerificado(acesso.tokenId))) {
    return (
      <Pagina>
        <Marca titulo="Ficha de cadastro" />
        <h1 className="text-xl font-bold">Olá{nome ? `, ${nome}` : ''}!</h1>
        <FormVerificacao token={token} />
      </Pagina>
    );
  }

  const dados = DadosFichaSchema.safeParse(acesso.ficha.dadosAtuais);
  if (!dados.success) notFound();

  return (
    <Pagina>
      <Marca titulo="Ficha de cadastro" />
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">Olá{nome ? `, ${nome}` : ''}!</h1>
        <p>
          Confira seus dados e complete o que faltar. <strong>Tudo é salvo automaticamente.</strong> Ao terminar, clique em{' '}
          <strong>Concluir ficha</strong>.
        </p>
        <p className="text-xs text-texto/60">
          As informações desta ficha são confidenciais e usadas só para organizar a sua viagem. Este link é pessoal; não o
          compartilhe. Válido até {formatarData.format(new Date(acesso.expiraEm))}.
        </p>
      </div>
      <FichaCliente token={token} statusInicial={acesso.ficha.status} valoresIniciais={dados.data} />
    </Pagina>
  );
}
