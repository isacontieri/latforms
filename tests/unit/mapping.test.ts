import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAMPOS_FICHA } from '@/lib/ficha/campos';
import { mapearParaFicha } from '@/lib/ficha/mapping';
import { CHAVES_RD, type CamposRd } from '@/lib/rd/colunas';
import { extrairLinha } from '@/lib/rd/extrair';
import { decodificar, parseCsvRd } from '@/lib/rd/parse-csv';

const csv = parseCsvRd(decodificar(readFileSync(new URL('../fixtures/rd-export.csv', import.meta.url))));
const fichaDe = (sufixo: string) => {
  const linha = csv.linhas.find((l) => l.ID.endsWith(sufixo));
  if (!linha) throw new Error(`linha ${sufixo} não encontrada`);
  return mapearParaFicha(extrairLinha(linha).dados.campos);
};

/** Campos com tudo null, para testar uma regra por vez. */
const campos = (parcial: Partial<CamposRd>): CamposRd =>
  ({ ...Object.fromEntries(CHAVES_RD.map((k) => [k, null])), ...parcial }) as CamposRd;

describe('caso de referência completo (…a03)', () => {
  const f = fichaDe('a03');

  it('leva cada coluna do RD 1:1 para o campo de mesmo nome', () => {
    expect(f).toMatchObject({
      nome: 'Antônio Ribeiro Neto',
      apelido: 'Antônio',
      nascimento: '18/03/1945',
      nacionalidade: 'Brasileira',
      cpf: '123.456.789-09',
      rg: '12.345.678-9 SSP-SP',
      rne: null,
      telefone: '(16) 98000-1111',
      email: 'antonio.neto@exemplo.com',
      preferenciaContato: 'E-mail',
      agenciaNome: 'Agência Exemplo Eventos e Viagens',
      endereco: 'Rodovia Exemplo',
      numero: '100',
      complemento: 'Casa 3 Cond Colina Verde',
      bairro: 'Nova Aliança',
      cidade: 'Ribeirao Preto',
      estado: 'SP',
      cep: '14026-800',
      pais: 'Brasil',
      passaporte: 'GB123456',
      passaportePaisEmissor: 'Brasil',
      passaporteEmissao: '19/02/2020',
      passaporteExpiracao: '09/02/2030',
      emergenciaNome: 'Maria Aparecida Souza',
      emergenciaParentesco: 'Secretaria',
      emergenciaTelefone: '(16) 99000-1111',
      emergenciaEmail: 'maria.souza@exemplo.com',
      medicoNome: 'Dr. Fulano de Tal',
      medicoTelefone: '(16) 99999-0000',
      altura: '1,65',
      peso: '84',
      calcado: '37',
      tamanhoRoupa: 'GG',
      idiomas: 'Ingles, Espanhol',
      assento: 'corredor',
      tipoSanguineo: 'O+',
      ultimoCheckup: '12/06/2023',
      seConsideraSaudavel: 'Sim',
      praticaAtividadeFisica: 'Sim',
      sabeNadar: 'Sim',
      temRestricaoFisica: 'Sim',
      restricaoFisicaDescricao: 'dificuldade em longas caminhadas',
      temDoencaCronica: 'Não',
      doencaCronicaDescricao: null, // veio n/a
      usaMedicamento: 'Não',
      fezCirurgia: 'Não',
      temQuestaoMedica: 'Não',
      temAlergia: 'Não',
      vacinas: 'Febre amarela, Covid-19',
      acompanhamentoPsiquiatrico: 'Não',
      tratamentoOdontologico: 'Sim',
      alimentosNaoCome: 'nao gosto de nada com muito alho e cebola crua',
      consomeAlcool: 'Sim',
      querCatalogoFisico: 'Sim',
      enderecoPostalIgual: 'Não',
    });
  });

  it('campos do modelo de 2024 ficam para o cliente', () => {
    expect([f.estadoCivil, f.convenioMedico, f.condicionamentoFisico, f.diabetico, f.disturbioCardioRespiratorio])
      .toEqual([null, null, null, null, null]);
  });
});

describe('caso parcial (…a01)', () => {
  const f = fichaDe('a01');
  it('data ISO, primeiro telefone, país pela nacionalidade', () => {
    expect(f.nascimento).toBe('19/02/1960');
    expect(f.telefone).toBe('(19) 99888-1234');
    expect(f.pais).toBe('Brasil');
    expect(f.numero).toBe('220');
    expect(f.complemento).toBe('Torre 3 apto. 223');
    expect(f.apelido).toBe('Carlão');
    expect(f.cidade).toBeNull();
  });
});

describe('casos quase vazios (…a02, …a04)', () => {
  it.each(['a02', 'a04'])('%s gera ficha só com nome, e-mail e celular', (id) => {
    const preenchidos = Object.entries(fichaDe(id)).filter(([, v]) => v !== null).map(([k]) => k);
    expect(preenchidos.sort()).toEqual(['email', 'nome', 'telefone']);
  });
});

describe('regras do mapeamento', () => {
  it('toda chave de CAMPOS_FICHA existe no resultado', () => {
    expect(Object.keys(mapearParaFicha(campos({}))).sort()).toEqual(CAMPOS_FICHA.map((c) => c.chave).sort());
  });

  it('sim/não só entra se for exatamente Sim ou Não', () => {
    expect(mapearParaFicha(campos({ sabeNadar: 'Sim' })).sabeNadar).toBe('Sim');
    expect(mapearParaFicha(campos({ sabeNadar: 'talvez' })).sabeNadar).toBeNull();
  });

  it('não infere saúde: atividade física não vira condicionamento', () => {
    const f = mapearParaFicha(campos({ praticaAtividadeFisica: 'Sim' }));
    expect(f.praticaAtividadeFisica).toBe('Sim');
    expect(f.condicionamentoFisico).toBeNull();
  });

  it('vencimento usa o passaporte brasileiro, não o estrangeiro', () => {
    expect(mapearParaFicha(campos({ passaporteEstrangeiroExpiracao: '01/01/2031' })).passaporteExpiracao).toBeNull();
  });

  it('país não vira Brasil para outra nacionalidade', () => {
    expect(mapearParaFicha(campos({ nacionalidade: 'Argentina' })).pais).toBeNull();
  });

  it('listas e números viram texto', () => {
    const f = mapearParaFicha(campos({ vacinas: ['Tétano', 'Covid-19'], altura: 1.8 }));
    expect(f.vacinas).toBe('Tétano, Covid-19');
    expect(f.altura).toBe('1,8');
  });

  it('colunas fora da lista não entram na ficha (ex.: observações internas, qual dieta, cargo)', () => {
    const f = mapearParaFicha(campos({ observacoesInternas: 'cliente difícil', qualDieta: 'Vegana', cargo: 'Engenheiro' }));
    expect(JSON.stringify(f)).not.toMatch(/cliente difícil|Vegana|Engenheiro/);
  });
});
