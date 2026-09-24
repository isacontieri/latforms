import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAVES_RD, COLUNAS_RD } from '@/lib/rd/colunas';
import { extrairLinha, primeiroNome, verificarCabecalhos } from '@/lib/rd/extrair';
import { decodificar, parseCsvRd } from '@/lib/rd/parse-csv';

const csv = parseCsvRd(decodificar(readFileSync(new URL('../fixtures/rd-export.csv', import.meta.url))));
const porId = (sufixo: string) => {
  const linha = csv.linhas.find((l) => l.ID.endsWith(sufixo));
  if (!linha) throw new Error(`linha ${sufixo} não encontrada`);
  return extrairLinha(linha);
};

describe('catálogo', () => {
  it('tem as 98 colunas do export', () => expect(COLUNAS_RD).toHaveLength(98));
  it('não repete cabeçalho', () => {
    expect(new Set(COLUNAS_RD.map((c) => c.coluna)).size).toBe(98);
  });
});

describe('extrairLinha — caso completo (…a03)', () => {
  const r = porId('a03');
  const c = r.dados.campos;

  it('sem erro e sem avisos', () => {
    expect(r.erro).toBeNull();
    expect(r.avisos).toEqual([]);
  });

  it('extrai todas as chaves do catálogo', () => {
    expect(Object.keys(c).sort()).toEqual([...CHAVES_RD].sort());
  });

  it('normaliza cada tipo', () => {
    expect(c.nome).toBe('Antônio Ribeiro Neto');
    expect(c.cpf).toBe('123.456.789-09');
    expect(c.passaporte).toBe('GB123456');
    expect(c.nascimento).toBe('18/03/1945');
    expect(c.passaporteExpiracao).toBe('09/02/2030');
    expect(c.telefone).toBe('(16) 98000-1111');
    expect(c.emergenciaTelefone).toBe('(16) 99000-1111');
    expect(c.medicoTelefone).toBe('(16) 99999-0000');
    expect(c.complemento).toBe('Casa 3 Cond Colina Verde');
    expect(c.altura).toBe(1.65);
    expect(c.peso).toBe(84);
    expect(c.vacinas).toEqual(['Febre amarela', 'Covid-19']);
    expect(c.idiomas).toEqual(['Ingles', 'Espanhol']);
    expect(c.sabeNadar).toBe('Sim');
    expect(c.temDoencaCronica).toBe('Não');
    expect(c.rdHoraCriacao).toBe('14:03');
    expect(c.rdEmpresaId).toBe('000000000000000000000b03');
    expect(c.medicamentosDescricao).toBeNull(); // veio n/a
    expect(c.primeiroNome).toBe('Antônio Ribeiro Neto'); // o RD às vezes manda o nome completo
  });

  it('guarda a linha original sem as células vazias', () => {
    expect(r.dados.original.CPF).toBe('123.456.789-09');
    expect(r.dados.original).not.toHaveProperty('RNE');
    expect(r.dados.extras).toEqual({});
  });
});

describe('extrairLinha — caso parcial (…a01)', () => {
  const r = porId('a01');
  const c = r.dados.campos;

  it('extrai colunas que não vão para o PDF', () => {
    expect(c.aeroportoOrigem).toBe('Internacional de Viracopos');
    expect(c.levaAcompanhante).toBe('Não');
    expect(c.distribuidora).toBe('Distribuidora Exemplo Ltda');
    expect(c.tipoInscricao).toBe('Titular');
    expect(c.rdBaseLegalComunicacao).toBe('legitimate_interest');
  });

  it('descarta "Não!" em texto livre e usa o primeiro telefone', () => {
    expect(c.observacaoExtra).toBeNull();
    expect(c.telefone).toBe('(19) 99888-1234');
    expect(c.email).toBe('carlos.pereira@exemplo.com.br');
    expect(c.nascimento).toBe('19/02/1960');
  });
});

describe('extrairLinha — regras de linha', () => {
  it('casos vazios não têm erro', () => {
    for (const id of ['a02', 'a04']) {
      const r = porId(id);
      expect(r.erro).toBeNull();
      expect(r.dados.campos.nome).toBeTruthy();
    }
  });

  it('linha sem ID vira erro', () => {
    expect(extrairLinha({ Nome: 'Ana', ID: '' }).erro).toBe('linha sem ID do RD');
  });

  it('nome vazio usa o e-mail, depois "(sem nome)"', () => {
    expect(extrairLinha({ ID: '1', Email: 'a@b.com' }).nome).toBe('a@b.com');
    const r = extrairLinha({ ID: '1' });
    expect(r.nome).toBe('(sem nome)');
    expect(r.avisos).toContain('contato sem nome');
  });

  it('coluna fora do catálogo vai para extras', () => {
    const r = extrairLinha({ ID: '1', Nome: 'Ana', 'Pergunta nova do RD?': ' resposta ' });
    expect(r.dados.extras).toEqual({ 'Pergunta nova do RD?': 'resposta' });
  });

  it('combina colunas duplicadas do RD (Estado / Estado:)', () => {
    expect(extrairLinha({ ID: '1', Estado: '', 'Estado:': 'SP' }).dados.campos.estado).toBe('SP');
    const r = extrairLinha({ ID: '1', Nome: 'Ana', Estado: 'SP', 'Estado:': 'RJ' });
    expect(r.dados.campos.estado).toBe('SP — RJ');
    expect(r.avisos).toHaveLength(1);
  });

  it('aviso cita a coluna, não o valor', () => {
    const r = extrairLinha({ ID: '1', Nome: 'Ana', CPF: '111.222.333-44' });
    expect(r.avisos).toEqual(['CPF: dígito verificador inválido']);
    expect(r.avisos.join()).not.toContain('111');
  });
});

describe('verificarCabecalhos', () => {
  it('fixture não tem colunas novas nem ausentes', () => {
    expect(verificarCabecalhos(csv.cabecalhos)).toEqual({ novas: [], ausentes: [] });
  });
  it('detecta coluna nova e ausente', () => {
    const r = verificarCabecalhos(['ID', 'Nome', 'Pergunta nova']);
    expect(r.novas).toEqual(['Pergunta nova']);
    expect(r.ausentes).toHaveLength(96);
  });
});

describe('primeiroNome', () => {
  it('pega a primeira palavra', () => expect(primeiroNome(' Antônio Ribeiro Neto')).toBe('Antônio'));
});
