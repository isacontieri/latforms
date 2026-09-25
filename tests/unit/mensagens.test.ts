import { describe, expect, it } from 'vitest';
import { linkMailto, mensagemDoLink } from '@/lib/equipe/mensagens';

const url = 'https://latforms.vercel.app/convite/AbC_123-xyz';
const expiraEm = '2026-10-02T14:36:00Z'; // 11:36 em São Paulo

describe('mensagemDoLink', () => {
  it('convite: saudação pelo primeiro nome, link, validade e assinatura', () => {
    const { assunto, corpo } = mensagemDoLink({ tipo: 'convite', url, expiraEm, nomeDestinatario: 'Beatriz Souza', remetente: 'Isabelle' });
    expect(assunto).toBe('Seu acesso ao LatForms — Latitudes');
    expect(corpo).toMatch(/^Olá, Beatriz!\n/);
    expect(corpo).toContain(`\n${url}\n`);
    expect(corpo).toContain('O link vale até 02/10/2026, 11:36');
    expect(corpo.endsWith('Abraço,\nIsabelle')).toBe(true);
  });

  it('convite sem nome: saudação neutra', () => {
    expect(mensagemDoLink({ tipo: 'convite', url, expiraEm, remetente: 'Isabelle' }).corpo).toMatch(/^Olá!\n/);
  });

  it('nova senha tem assunto e texto próprios', () => {
    const { assunto, corpo } = mensagemDoLink({ tipo: 'nova_senha', url, expiraEm, nomeDestinatario: 'Ana', remetente: 'Isabelle' });
    expect(assunto).toBe('Nova senha do LatForms — Latitudes');
    expect(corpo).toContain('definir uma nova senha');
    expect(corpo).toContain(url);
  });
});

describe('linkMailto', () => {
  it('monta destinatário, assunto e corpo codificados (quebras de linha CRLF)', () => {
    const href = linkMailto('beatriz@latitudes.com.br', 'Assunto — ç', 'Linha 1\nLinha 2 & link?x=1');
    expect(href.startsWith('mailto:beatriz@latitudes.com.br?subject=')).toBe(true);
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    expect(params.get('subject')).toBe('Assunto — ç');
    expect(params.get('body')).toBe('Linha 1\r\nLinha 2 & link?x=1');
  });

  it('e-mail com + continua válido', () => {
    expect(linkMailto('ana+teste@ex.com', 'a', 'b')).toMatch(/^mailto:ana%2Bteste@ex\.com\?/);
  });
});
