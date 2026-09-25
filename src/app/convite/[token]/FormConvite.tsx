'use client';

import { useActionState, useState } from 'react';
import { problemasDaSenha } from '@/lib/equipe/senha';
import { aceitarConvite, type EstadoConvite } from './actions';

const inicial: EstadoConvite = { erro: null };
const CAMPO = 'h-10 w-full rounded-sm bg-campo px-3 outline-none focus:ring-2 focus:ring-laranja';

export function FormConvite({
  token,
  tipo,
  email,
  nomeSugerido,
}: {
  token: string;
  tipo: 'convite' | 'nova_senha';
  email: string;
  nomeSugerido: string | null;
}) {
  const [estado, acao, enviando] = useActionState(aceitarConvite.bind(null, token), inicial);
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const faltando = problemasDaSenha(senha);

  return (
    <form action={acao} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">E-mail (login)</span>
        <span className="rounded-sm border border-campo px-3 py-2 text-sm">{email}</span>
      </div>

      {tipo === 'convite' && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Seu nome</span>
          <input name="nome" defaultValue={nomeSugerido ?? ''} required maxLength={120} autoComplete="name" className={CAMPO} />
        </label>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="senha" className="text-sm font-bold">{tipo === 'convite' ? 'Crie uma senha' : 'Nova senha'}</label>
        <div className="relative">
          <input
            id="senha"
            name="senha"
            type={mostrar ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={`${CAMPO} pr-20`}
          />
          <button
            type="button"
            onClick={() => setMostrar((v) => !v)}
            aria-pressed={mostrar}
            className="absolute inset-y-0 right-0 px-3 text-xs font-bold text-texto/70 hover:text-laranja"
          >
            {mostrar ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        <ul className="text-xs text-texto/70" aria-live="polite">
          {['ter pelo menos 8 caracteres', 'ter uma letra maiúscula', 'ter uma letra minúscula', 'ter um número', 'ter um caractere especial (ex.: # @ ! %)'].map((r) => (
            <li key={r} className={senha && !faltando.includes(r) ? 'text-green-700' : ''}>
              {senha && !faltando.includes(r) ? '✓' : '•'} {r[0].toUpperCase() + r.slice(1)}
            </li>
          ))}
        </ul>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Repita a senha</span>
        <input name="confirmacao" type={mostrar ? 'text' : 'password'} required autoComplete="new-password" className={CAMPO} />
      </label>

      {estado.erro && <p role="alert" className="text-sm text-red-700">{estado.erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="h-10 rounded-sm bg-laranja font-bold text-white hover:bg-laranja-escuro disabled:opacity-60"
      >
        {enviando ? 'Salvando…' : tipo === 'convite' ? 'Criar meu acesso' : 'Salvar nova senha'}
      </button>
    </form>
  );
}
