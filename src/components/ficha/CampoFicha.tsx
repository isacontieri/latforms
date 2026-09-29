'use client';

import type { CampoLayout } from '@/lib/ficha/layout-gerar';
import { autocompleteDo, inputModeDo, mascarar } from '@/lib/ficha/mascaras';

export interface EstadoCampo {
  /** Valor atual ≠ original do RD (amarelo, só no painel). */
  alterado?: boolean;
  /** O cliente está neste campo agora (contorno azul, só no painel). */
  editando?: boolean;
  /** Acabou de mudar (pulso de 2 s). */
  recente?: boolean;
  /** Salvo agora há pouco (✓ discreto, só para o cliente). */
  salvo?: boolean;
  /** Esmaecido pelo filtro "só alterados". */
  erro?: string | null;
  /** Texto do tooltip (ex.: "Antes: … · Alterado às 14:32"). */
  dica?: string;
}

export function CampoFicha({
  campo,
  valor,
  estado = {},
  somenteLeitura,
  variante,
  onChange,
  onFocus,
  onBlur,
}: {
  campo: CampoLayout;
  valor: string | null;
  estado?: EstadoCampo;
  somenteLeitura?: boolean;
  variante: 'documento' | 'lista';
  onChange?: (valor: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const classes = [
    'ficha-campo',
    variante === 'documento' ? 'ficha-campo-documento' : 'ficha-campo-lista',
    estado.alterado && 'ficha-alterado',
    estado.editando && 'ficha-editando',
    estado.recente && 'ficha-recente',
    estado.erro && 'ficha-erro',
  ]
    .filter(Boolean)
    .join(' ');

  const comum = {
    'data-campo': campo.chave,
    'aria-label': campo.rotulo,
    'aria-invalid': estado.erro ? true : undefined,
    'aria-describedby': estado.erro ? `erro-${campo.chave}` : undefined,
    title: estado.dica,
    disabled: somenteLeitura,
    onFocus,
    onBlur,
    className: classes,
  };

  const texto = valor ?? '';
  let controle: React.ReactNode;
  if (campo.tipo === 'select') {
    controle = (
      <select {...comum} value={texto} onChange={(e) => onChange?.(e.target.value)}>
        <option value="">Selecione</option>
        {campo.opcoes?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (campo.tipo === 'textoLongo') {
    controle = <textarea {...comum} value={texto} maxLength={1000} onChange={(e) => onChange?.(e.target.value)} />;
  } else {
    controle = (
      <input
        {...comum}
        type={campo.formato === 'email' ? 'email' : 'text'}
        inputMode={inputModeDo(campo.formato)}
        autoComplete={autocompleteDo(campo.chave)}
        placeholder={campo.formato === 'data' ? 'DD/MM/AAAA' : undefined}
        value={texto}
        maxLength={campo.formato === 'data' ? 10 : 500}
        onChange={(e) => onChange?.(mascarar(campo.formato, e.target.value))}
      />
    );
  }

  return (
    <>
      {controle}
      {estado.editando && <span className="ficha-etiqueta-editando" aria-hidden>Cliente editando</span>}
      {estado.alterado && variante === 'documento' && <span className="ficha-icone-alterado" aria-hidden>✎</span>}
      {estado.salvo && <span className="ficha-icone-salvo" aria-hidden>✓</span>}
      {estado.erro && (
        <span id={`erro-${campo.chave}`} role="alert" className="ficha-mensagem-erro">
          {estado.erro}
        </span>
      )}
    </>
  );
}
