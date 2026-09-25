/** Textos dos links de equipe (e-mail aberto no Outlook de quem convida, ou mensagem copiada). */

export interface DadosMensagem {
  tipo: 'convite' | 'nova_senha';
  url: string;
  expiraEm: string;
  /** Nome de quem recebe (se conhecido). */
  nomeDestinatario?: string | null;
  /** Nome de quem está enviando (funcionário logado). */
  remetente: string;
}

const formatarValidade = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

export function mensagemDoLink(d: DadosMensagem): { assunto: string; corpo: string } {
  const primeiroNome = d.nomeDestinatario?.trim().split(/\s+/)[0];
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : 'Olá!';
  const validade = formatarValidade(d.expiraEm);

  if (d.tipo === 'convite') {
    return {
      assunto: 'Seu acesso ao LatForms — Latitudes',
      corpo: [
        saudacao,
        '',
        'Você foi convidada(o) para o LatForms, o sistema de fichas de cadastro da Latitudes.',
        '',
        'Para criar seu acesso, abra o link abaixo, confira seu nome e crie uma senha:',
        d.url,
        '',
        `O link vale até ${validade} e pode ser usado uma única vez. Depois é só entrar com seu e-mail e a senha criada.`,
        '',
        'Abraço,',
        d.remetente,
      ].join('\n'),
    };
  }
  return {
    assunto: 'Nova senha do LatForms — Latitudes',
    corpo: [
      saudacao,
      '',
      'Segue o link para você definir uma nova senha no LatForms:',
      d.url,
      '',
      `O link vale até ${validade} e pode ser usado uma única vez.`,
      '',
      'Abraço,',
      d.remetente,
    ].join('\n'),
  };
}

/** `mailto:` com destinatário, assunto e corpo (quebras de linha como CRLF, como pede a RFC 6068). */
export function linkMailto(email: string, assunto: string, corpo: string): string {
  const q = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, '\r\n'));
  return `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}?subject=${q(assunto)}&body=${q(corpo)}`;
}
