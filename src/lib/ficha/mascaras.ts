import type { FormatoCampo } from './campos';

/** Máscara progressiva enquanto o cliente digita (CPF, CEP, telefone, data). E-mail não tem máscara. */
export function mascarar(formato: FormatoCampo | undefined, entrada: string): string {
  if (!formato || formato === 'email') return entrada;
  const d = entrada.replace(/\D/g, '');

  switch (formato) {
    case 'cpf': {
      const n = d.slice(0, 11);
      return n
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    }
    case 'cep':
      // código postal estrangeiro (tem letra): deixa como digitado
      if (/[A-Za-z]/.test(entrada)) return entrada.slice(0, 12);
      return d.slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
    case 'data': {
      const n = d.slice(0, 8);
      return n.replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
    }
    case 'telefone': {
      // número internacional (+DDI): sem máscara, só limita os caracteres
      if (entrada.trimStart().startsWith('+')) return entrada.replace(/[^\d\s()+.-]/g, '').slice(0, 25);
      const n = d.slice(0, 11);
      if (n.length <= 2) return n.length ? `(${n}` : '';
      if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
      if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
      return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    }
  }
}

/** Teclado adequado no celular. */
export function inputModeDo(formato: FormatoCampo | undefined): 'numeric' | 'tel' | 'email' | 'text' {
  if (formato === 'cpf' || formato === 'data' || formato === 'cep') return 'numeric';
  if (formato === 'telefone') return 'tel';
  if (formato === 'email') return 'email';
  return 'text';
}

const AUTOCOMPLETE: Record<string, string> = {
  nome: 'name',
  email: 'email',
  telefone: 'tel',
  cep: 'postal-code',
  endereco: 'address-line1',
  complemento: 'address-line2',
  cidade: 'address-level2',
  estado: 'address-level1',
  pais: 'country-name',
  nascimento: 'bday',
};

export function autocompleteDo(chave: string): string {
  return AUTOCOMPLETE[chave] ?? 'off';
}
