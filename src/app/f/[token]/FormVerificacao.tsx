'use client';

import { useActionState, useState } from 'react';
import { mascarar } from '@/lib/ficha/mascaras';
import { verificarNascimento, type EstadoVerificacao } from './actions';

const inicial: EstadoVerificacao = { erro: null };

export function FormVerificacao({ token }: { token: string }) {
  const [estado, acao, enviando] = useActionState(verificarNascimento.bind(null, token), inicial);
  const [valor, setValor] = useState('');
  return (
    <form action={acao} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Para sua segurança, confirme sua data de nascimento</span>
        <input
          name="nascimento"
          inputMode="numeric"
          placeholder="DD/MM/AAAA"
          autoComplete="bday"
          required
          value={valor}
          onChange={(e) => setValor(mascarar('data', e.target.value))}
          className="h-11 rounded-sm bg-campo px-3 text-base outline-none focus:ring-2 focus:ring-laranja"
        />
      </label>
      {estado.erro && <p role="alert" className="text-sm text-red-700">{estado.erro}</p>}
      <button type="submit" disabled={enviando} className="h-11 rounded-sm bg-laranja font-bold text-white hover:bg-laranja-escuro disabled:opacity-60">
        {enviando ? 'Conferindo…' : 'Abrir minha ficha'}
      </button>
    </form>
  );
}
