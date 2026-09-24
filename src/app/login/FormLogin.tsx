'use client';

import { useActionState, useState } from 'react';
import { entrar, type EstadoLogin } from './actions';

const inicial: EstadoLogin = { erro: null };

export function FormLogin() {
  const [estado, acao, enviando] = useActionState(entrar, inicial);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  return (
    <form action={acao} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="h-10 rounded-sm bg-campo px-3 outline-none focus:ring-2 focus:ring-laranja"
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="senha" className="text-sm font-bold">
          Senha
        </label>
        <div className="relative">
          <input
            id="senha"
            name="senha"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="h-10 w-full rounded-sm bg-campo pr-20 pl-3 outline-none focus:ring-2 focus:ring-laranja"
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-pressed={mostrarSenha}
            className="absolute inset-y-0 right-0 px-3 text-xs font-bold text-texto/70 hover:text-laranja"
          >
            {mostrarSenha ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="h-10 rounded-sm bg-laranja font-bold text-white hover:bg-laranja-escuro disabled:opacity-60"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
