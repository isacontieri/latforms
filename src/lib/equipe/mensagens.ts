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

/**
 * Novo e-mail já preenchido no Outlook na web (Microsoft 365, usado pela Latitudes). Abre numa aba nova;
 * funciona mesmo sem programa de e-mail instalado/definido como padrão no Windows (um `mailto:` não abria nada).
 */
export function linkOutlookWeb(email: string, assunto: string, corpo: string): string {
  const p = new URLSearchParams({ to: email, subject: assunto, body: corpo });
  return `https://outlook.office.com/mail/deeplink/compose?${p.toString().replace(/\+/g, '%20')}`;
}

/** E-mail com o link da ficha para o cliente. */
export function mensagemLinkCliente(d: { url: string; expiraEm: string; nomeCliente: string | null; remetente: string }) {
  const primeiroNome = d.nomeCliente?.trim().split(/\s+/)[0];
  return {
    assunto: 'Sua Ficha de Cadastro — Latitudes',
    corpo: [
      primeiroNome ? `Olá, ${primeiroNome}!` : 'Olá!',
      '',
      'Para organizarmos a sua viagem, precisamos que você confira e complete a sua Ficha de Cadastro.',
      'Ela já vem preenchida com as informações que você nos passou.',
      '',
      'É simples:',
      '1. Abra o link abaixo e baixe a ficha (PDF).',
      '2. Abra no computador, de preferência no Adobe Acrobat Reader, confira e complete os campos.',
      '3. Salve e envie o arquivo pelo mesmo link.',
      '',
      d.url,
      '',
      `O link é pessoal e vale até ${formatarValidade(d.expiraEm).split(',')[0]}.`,
      '',
      'Qualquer dúvida, é só responder este e-mail.',
      '',
      'Abraço,',
      d.remetente,
      'Latitudes',
    ].join('\n'),
  };
}
