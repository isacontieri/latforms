import { CAMPO_POR_CHAVE, SECOES_FICHA } from '@/lib/ficha/campos';
import type { DadosFicha } from '@/lib/ficha/schema';

/**
 * Os 71 campos da ficha, nas mesmas seções do PDF.
 * Com `compararCom`, destaca os campos cujo valor é diferente (ex.: RD atual × versão devolvida pelo cliente).
 */
export function DadosDaFicha({
  dados,
  compararCom,
  rotuloComparacao,
}: {
  dados: DadosFicha;
  compararCom?: DadosFicha | null;
  rotuloComparacao?: string;
}) {
  const diferentes = compararCom
    ? new Set(Object.keys(dados).filter((k) => (dados[k as keyof DadosFicha] ?? null) !== (compararCom[k as keyof DadosFicha] ?? null)))
    : new Set<string>();

  return (
    <div className="flex flex-col gap-3">
      {compararCom && (
        <p className="text-sm">
          {diferentes.size === 0 ? (
            'Nenhuma diferença.'
          ) : (
            <>
              <span className="font-bold text-laranja-escuro">{diferentes.size} campo(s) diferente(s)</span> {rotuloComparacao}
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
              {difNaSecao > 0 && <span className="font-normal text-laranja-escuro"> ({difNaSecao} diferente{difNaSecao > 1 ? 's' : ''})</span>}
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
                      className={`min-h-7 rounded-sm bg-campo px-2 py-1 text-sm whitespace-pre-line ${v === null ? 'text-texto/50 italic' : ''} ${
                        diferente ? 'ring-2 ring-laranja' : ''
                      }`}
                    >
                      {v === null ? (campo.origem ? 'vazio' : 'cliente preenche') : v}
                    </dd>
                    {diferente && compararCom && (
                      <span className="text-xs text-laranja-escuro">
                        na outra versão: {compararCom[k as keyof DadosFicha] ?? 'vazio'}
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
