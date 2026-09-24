import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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

  it('bate com o esperado da skill', () => {
    expect(f).toEqual({
      nomeCompleto: 'Antônio Ribeiro Neto',
      nascimento: '18/03/1945',
      cpf: '123.456.789-09',
      rg: '12.345.678-9 SSP-SP',
      passaporte: 'GB123456',
      vencimentoPassaporte: '09/02/2030',
      nacionalidade: 'Brasileira',
      cep: '14026-800',
      endereco: 'Rodovia Exemplo',
      numeroComplemento: '100 / Casa 3 Cond Colina Verde',
      bairro: 'Nova Aliança',
      cidade: 'Ribeirao Preto',
      estado: 'SP',
      pais: 'Brasil',
      celular: '(16) 98000-1111',
      email: 'antonio.neto@exemplo.com',
      profissao: null,
      estadoCivil: null,
      contatoEmergencia: 'Maria Aparecida Souza (Secretaria)',
      telefoneEmergencia: '(16) 99000-1111',
      medicamentoRegular: 'Não',
      alergias: 'Não',
      tipoSanguineo: 'O+',
      convenioMedico: null,
      antecedentesClinicos: 'Não',
      condicionamentoFisico: null,
      sabeNadar: 'Sim',
      diabetico: null,
      disturbioCardioRespiratorio: null,
      restricoesAlimentares: 'Sim',
      descricaoRestricoes: 'nao gosto de nada com muito alho e cebola crua',
      vacinaTetano: false,
      vacinaFebreAmarela: true,
      vacinaCovid: true,
      outrasObservacoes: 'Mobilidade: dificuldade em longas caminhadas\nPrefere ser chamado(a): Antônio',
    });
  });
});

describe('caso de referência parcial (…a01)', () => {
  const f = fichaDe('a01');
  it('usa país pela nacionalidade e ignora "Não!"', () => {
    expect(f.nascimento).toBe('19/02/1960');
    expect(f.celular).toBe('(19) 99888-1234');
    expect(f.pais).toBe('Brasil');
    expect(f.numeroComplemento).toBe('220 / Torre 3 apto. 223');
    expect(f.outrasObservacoes).toBe('Prefere ser chamado(a): Carlão');
    expect(f.cidade).toBeNull();
  });
});

describe('casos quase vazios (…a02, …a04)', () => {
  it.each(['a02', 'a04'])('%s gera ficha só com nome, e-mail e celular', (id) => {
    const f = fichaDe(id);
    const preenchidos = Object.entries(f).filter(([, v]) => v !== null && v !== false).map(([k]) => k);
    expect(preenchidos.sort()).toEqual(['celular', 'email', 'nomeCompleto']);
  });
});

describe('regras do mapeamento', () => {
  it('campos sem fonte no CSV ficam para o cliente', () => {
    const f = mapearParaFicha(campos({ praticaAtividadeFisica: 'Sim' }));
    expect(f.estadoCivil).toBeNull();
    expect(f.convenioMedico).toBeNull();
    expect(f.condicionamentoFisico).toBeNull(); // não inferir de atividade física
    expect(f.diabetico).toBeNull();
    expect(f.disturbioCardioRespiratorio).toBeNull();
  });

  it('vencimento usa o passaporte brasileiro, não o estrangeiro', () => {
    expect(mapearParaFicha(campos({ passaporteEstrangeiroExpiracao: '01/01/2031' })).vencimentoPassaporte).toBeNull();
  });

  it('pais não vira Brasil para outra nacionalidade', () => {
    expect(mapearParaFicha(campos({ nacionalidade: 'Argentina' })).pais).toBeNull();
  });

  it('contato de emergência sem parentesco', () => {
    expect(mapearParaFicha(campos({ emergenciaNome: 'Ana' })).contatoEmergencia).toBe('Ana');
  });

  it('medicamento: descrição > resposta sim/não > null', () => {
    expect(mapearParaFicha(campos({ usaMedicamento: 'Sim', medicamentosDescricao: 'Losartana' })).medicamentoRegular).toBe('Losartana');
    expect(mapearParaFicha(campos({ usaMedicamento: 'Sim' })).medicamentoRegular).toBe('Sim');
    expect(mapearParaFicha(campos({})).medicamentoRegular).toBeNull();
  });

  it('alergias junta descrições com prefixo da alimentar', () => {
    const f = mapearParaFicha(campos({ temAlergia: 'Sim', alergiasDescricao: 'Dipirona', alergiaAlimentarDescricao: 'Camarão' }));
    expect(f.alergias).toBe('Dipirona — Alimentar: Camarão');
  });

  it('antecedentes: "Não" só se as três perguntas forem Não', () => {
    expect(mapearParaFicha(campos({ temDoencaCronica: 'Não', fezCirurgia: 'Não' })).antecedentesClinicos).toBeNull();
    expect(
      mapearParaFicha(campos({ fezCirurgia: 'Sim', cirurgiaDescricao: 'Apendicite, 2010', doencaCronicaDescricao: 'Hipertensão' }))
        .antecedentesClinicos,
    ).toBe('Hipertensão — Cirurgia: Apendicite, 2010');
  });

  it('restrições alimentares', () => {
    expect(mapearParaFicha(campos({ segueDieta: 'Não' })).restricoesAlimentares).toBe('Não');
    const f = mapearParaFicha(campos({ segueDieta: 'Sim', qualDieta: 'Vegana' }));
    expect(f.restricoesAlimentares).toBe('Sim');
    expect(f.descricaoRestricoes).toBe('Dieta: Vegana');
    expect(mapearParaFicha(campos({})).restricoesAlimentares).toBeNull();
  });

  it.each([
    [['Tétano'], true],
    [['antitetânica'], true],
    [['dTpa'], true],
    [['dT'], true],
    [['Covid-19', 'Febre amarela'], false],
  ])('vacina de tétano em %j → %s', (vacinas, esperado) => {
    expect(mapearParaFicha(campos({ vacinas })).vacinaTetano).toBe(esperado);
  });

  it('covid pelo certificado', () => {
    expect(mapearParaFicha(campos({ temCertificadoCovid: 'Sim' })).vacinaCovid).toBe(true);
  });

  it('observações internas nunca vão para a ficha', () => {
    const f = mapearParaFicha(campos({ observacoesInternas: 'cliente difícil' }));
    expect(JSON.stringify(f)).not.toContain('cliente difícil');
  });
});
