import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Marca } from '@/components/Marca';
import { dentroDoLimiteCliente, validarTokenCliente } from '@/lib/ficha/acesso-cliente';
import { proximoStatus } from '@/lib/ficha/status';
import { primeiroNome } from '@/lib/rd/extrair';
import { EnviarFicha } from './EnviarFicha';

export const metadata: Metadata = { title: 'Ficha de Cadastro — Latitudes', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const formatarData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });

function Passo({ n, titulo, children }: { n: number; titulo: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-laranja text-sm font-bold text-white">{n}</span>
      <div className="flex flex-1 flex-col gap-2 pt-0.5">
        <span className="font-bold">{titulo}</span>
        {children}
      </div>
    </li>
  );
}

/**
 * Página do cliente (sem login). Mostra só o primeiro nome; nenhum dado da ficha vai no HTML.
 * Abrir a página não muda o status (pré-visualizações de link também abrem a URL).
 */
export default async function PaginaCliente({ params }: PageProps<'/f/[token]'>) {
  const { token } = await params;

  if (!(await dentroDoLimiteCliente())) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
        <Marca titulo="Ficha de cadastro" />
        <p>Muitas tentativas em pouco tempo. Aguarde um minuto e recarregue a página.</p>
      </main>
    );
  }

  const acesso = await validarTokenCliente(token);
  if (!acesso) notFound();

  const { ficha } = acesso;
  const nome = primeiroNome(acesso.cliente.nome);
  const aceitaEnvio = proximoStatus(ficha.status, 'upload_valido') !== null;
  const jaEnviou = ficha.respondidaEm !== null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-10">
      <Marca titulo="Ficha de cadastro" />

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">Olá{nome ? `, ${nome}` : ''}!</h1>
        <p>
          Esta é a sua Ficha de Cadastro Latitudes. Ela já vem preenchida com o que você nos informou; confira, complete o que
          faltar e nos envie de volta por esta mesma página.
        </p>
        <p className="text-laranja italic">Por favor, não preencher à mão.</p>
      </div>

      {ficha.status === 'aprovada' && (
        <p className="rounded-sm border border-green-700/30 bg-green-50 p-3 text-sm text-green-800">
          Sua ficha foi recebida e conferida pela equipe. Está tudo certo — obrigado!
        </p>
      )}
      {ficha.status === 'correcao_solicitada' && (
        <div className="rounded-sm border border-laranja bg-laranja/5 p-3 text-sm">
          <p className="font-bold">A equipe pediu uma correção na sua ficha:</p>
          <p className="mt-1 whitespace-pre-line">{ficha.motivoCorrecao ?? 'Confira os dados e envie de novo.'}</p>
        </div>
      )}
      {ficha.status === 'respondida' && jaEnviou && (
        <p className="rounded-sm border border-green-700/30 bg-green-50 p-3 text-sm text-green-800">
          Recebemos sua ficha em {formatarData.format(new Date(ficha.respondidaEm!))}. Se precisar corrigir algo, envie o arquivo
          de novo — o último envio é o que vale.
        </p>
      )}

      <ol className="flex flex-col gap-6">
        <Passo n={1} titulo="Baixe sua ficha">
          <a
            href={`/api/f/${token}/pdf`}
            className="flex h-11 items-center justify-center self-start rounded-sm bg-laranja px-5 font-bold text-white hover:bg-laranja-escuro"
          >
            Baixar ficha (PDF)
          </a>
        </Passo>
        <Passo n={2} titulo="Abra no computador, confira e complete">
          <p className="text-sm">
            Use de preferência o <strong>Adobe Acrobat Reader</strong> (gratuito). No celular, alguns aplicativos não salvam os
            campos corretamente.
          </p>
        </Passo>
        <Passo n={3} titulo="Salve o arquivo">
          <p className="text-sm">Salve no seu computador, mantendo o formato PDF.</p>
        </Passo>
        {aceitaEnvio && (
          <Passo n={4} titulo="Envie aqui">
            <EnviarFicha token={token} rotulo={jaEnviou ? 'Enviar a ficha de novo' : 'Clique para escolher a ficha preenchida'} />
          </Passo>
        )}
      </ol>

      <p className="text-xs text-texto/60">
        As informações desta ficha são confidenciais e usadas só para organizar a sua viagem. Este link é pessoal; não o
        compartilhe. Válido até {formatarData.format(new Date(acesso.expiraEm))}.
      </p>
    </main>
  );
}
