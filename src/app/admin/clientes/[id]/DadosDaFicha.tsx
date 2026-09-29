import { CAMPO_POR_CHAVE, SECOES_FICHA } from '@/lib/ficha/campos';
import { igual } from '@/lib/ficha/diff';
import type { DadosFicha } from '@/lib/ficha/schema';

/**
 * Os 71 campos da ficha, nas mesmas seções do PDF.
 * Com `compararCom`, destaca os campos cujo valor é diferente. `estilo="alterado"` usa o mesmo amarelo da ficha ao
 * vivo (alterações do cliente); `estilo="rd"` usa contorno laranja (comparação com o RD atual).
 */
export function DadosDaFicha({
  dados,
  compararCom,
  rotuloComparacao,
  estilo = 'rd',
  rotuloAnterior = 'na outra versão',
}: {
  dados: DadosFicha;
  compararCom?: DadosFicha | null;
  rotuloComparacao?: string;
  estilo?: 'alterado' | 'rd';
  rotuloAnterior?: string;
}) {
  const diferentes = compararCom
    ? new Set(Object.keys(dados).filter((k) => !igual(dados[k as keyof DadosFicha], compararCom[k as keyof DadosFicha])))
    : new Set<string>();

  return (
    <div className="flex flex-col gap-3">
      {compararCom && (
        <p className="text-sm">
          {diferentes.size === 0 ? (
            estilo === 'alterado' ? 'Nenhuma alteração para revisar.' : 'Nenhuma diferença.'
          ) : (
            <>
              <span className={`font-bold ${estilo === 'alterado' ? 'rounded-sm bg-alterado px-1' : 'text-laranja-escuro'}`}>
                {diferentes.size} campo(s)
              </span>{' '}
              {rotuloComparacao}
            </>
          )}
        </p>
      )}
      {SECOES_FICHA.map((secao) => {
        const chaves = secao.linhas.flat();
        const difNaSecao = chaves.filter((k) => diferentes.has(k)).length;
        return (
          <details key={secao.titulo} open={!compararCom || difNaSecao > 0} className="rounded-sm border border-campo p-3">
            <summary className="cursor-pointer text-sm font-bold">
              {secao.titulo}
              {difNaSecao > 0 && <span className="font-normal text-laranja-escuro">
                  {' '}
                  ({difNaSecao} {estilo === 'alterado' ? `alterado${difNaSecao > 1 ? 's' : ''}` : `diferente${difNaSecao > 1 ? 's' : ''}`})
                </span>}
            </summary>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {chaves.map((k) => {
                const campo = CAMPO_POR_CHAVE.get(k)!;
                const v = dados[k as keyof DadosFicha];
                const diferente = diferentes.has(k);
                return (
                  <div key={k} className={`flex flex-col gap-0.5 ${campo.tipo === 'multilinha' ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
                    <dt className="text-xs font-bold">{campo.rotulo}</dt>
                    <dd
                      data-chave={k}
                      data-alterado={diferente || undefined}
                      className={`min-h-7 rounded-sm px-2 py-1 text-sm whitespace-pre-line ${v === null ? 'text-texto/50 italic' : ''} ${
                        !diferente ? 'bg-campo' : estilo === 'alterado' ? 'bg-alterado ring-1 ring-alterado-borda' : 'bg-campo ring-2 ring-laranja'
                      }`}
                    >
                      {v === null ? (campo.origem ? 'vazio' : 'cliente preenche') : v}
                    </dd>
                    {diferente && compararCom && (
                      <span className="text-xs text-texto/60">
                        {rotuloAnterior}: {compararCom[k as keyof DadosFicha] ?? 'vazio'}
                      </span>
                    )}
                  </div>
                );
              })}
            </dl>
          </details>
        );
      })}
    </div>
  );
}
