import type { ChaveRd } from '@/lib/rd/colunas';

/**
 * Definição da Ficha de Cadastro (modelo gerado pelo sistema, v2 — 25/09/2026).
 * 66 campos do formulário do RD Station + 5 do modelo de 2024 que o cliente preenche.
 * A ordem e os rótulos seguem o formulário do RD (lista aprovada pela equipe).
 * O PDF, a leitura do PDF devolvido e a tela do admin saem daqui.
 */

export type TipoCampo = 'texto' | 'multilinha' | 'simNao' | 'opcoes';

export interface CampoFicha {
  /** Nome do campo no PDF e chave em `DadosFicha`. Igual à chave do RD quando há origem. */
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  /** Coluna do RD que preenche o campo; `null` = só o cliente preenche. */
  origem: ChaveRd | null;
  opcoes?: readonly string[];
  /** Pergunta à esquerda e lista à direita (padrão para sim/não). */
  emLinha?: boolean;
  /** Largura na grade de 12 colunas. */
  colunas: number;
}

export interface SecaoFicha {
  titulo: string;
  /** Cada linha é uma lista de chaves; as larguras vêm de `colunas` (soma ≤ 12). */
  linhas: string[][];
}

export const SIM_NAO = ['Sim', 'Não'] as const;
export const OPCOES_ESTADO_CIVIL = ['Solteiro', 'Casado', 'Separado', 'Divorciado', 'Viúvo'] as const;
export const OPCOES_CONDICIONAMENTO = ['Ótimo', 'Bom', 'Razoável', 'Ruim'] as const;

// genéricos para manter a chave literal (ChaveFicha vira a união exata das 71 chaves)
const t = <K extends ChaveRd>(chave: K, rotulo: string, colunas: number) =>
  ({ chave, rotulo, tipo: 'texto', origem: chave, colunas }) as const;
const m = <K extends ChaveRd>(chave: K, rotulo: string) =>
  ({ chave, rotulo, tipo: 'multilinha', origem: chave, colunas: 12 }) as const;
const sn = <K extends ChaveRd>(chave: K, rotulo: string, colunas = 12) =>
  ({ chave, rotulo, tipo: 'simNao', origem: chave, colunas }) as const;

export const CAMPOS_FICHA = [
  // Dados pessoais
  t('nome', 'Nome completo', 9),
  t('nascimento', 'Data de nascimento', 3),
  t('apelido', 'Como gostaria de ser chamado(a) durante a viagem?', 6),
  t('nacionalidade', 'Nacionalidade', 3),
  { chave: 'estadoCivil', rotulo: 'Estado civil', tipo: 'opcoes', origem: null, opcoes: OPCOES_ESTADO_CIVIL, colunas: 3 },
  t('cpf', 'CPF', 3),
  t('rg', 'RG', 4),
  t('rne', 'RNE (caso não seja estrangeiro, desconsidere)', 5),

  // Contato
  t('telefone', 'Telefone celular (com DDD ou DDI)', 5),
  t('email', 'E-mail', 7),
  t('preferenciaContato', 'Como prefere ser contatada(o)', 5),
  t('comoConheceu', 'Como conheceu a Latitudes?', 7),
  t('agenciaNome', 'Caso tenha sido através de uma agência de viagens, por favor indique o nome', 6),
  t('midiaOrigem', 'Caso tenha sido através de mídia digital, por favor especifique qual', 6),

  // Endereço
  t('endereco', 'Seu endereço', 9),
  t('numero', 'Número', 3),
  t('complemento', 'Complemento', 6),
  t('bairro', 'Bairro', 6),
  t('cidade', 'Cidade', 4),
  t('estado', 'Estado', 2),
  t('cep', 'CEP', 3),
  t('pais', 'País', 3),

  // Passaporte
  t('passaporte', 'N° do passaporte', 3),
  t('passaportePaisEmissor', 'País emissor', 3),
  t('passaporteEmissao', 'Data de emissão', 3),
  t('passaporteExpiracao', 'Qual data de expiração?', 3),
  sn('temPassaporteEstrangeiro', 'Possui passaporte estrangeiro?', 6),

  // Contato de emergência
  t('emergenciaNome', 'Nome do contato', 7),
  t('emergenciaParentesco', 'Grau de parentesco', 5),
  t('emergenciaTelefone', 'Telefone do contato de emergência (com DDD ou DDI)', 5),
  t('emergenciaEmail', 'E-mail (contato de emergência)', 7),

  // Médico
  t('medicoNome', 'Nome do seu médico(a)', 7),
  t('medicoTelefone', 'Telefone do seu médico(a) (com DDD ou DDI)', 5),
  { chave: 'convenioMedico', rotulo: 'Convênio médico', tipo: 'texto', origem: null, colunas: 12 },

  // Informações para a viagem
  t('altura', 'Sua altura (cm)', 3),
  t('peso', 'Seu peso (kg)', 3),
  t('calcado', 'N° de calçado (Brasil)', 3),
  t('tamanhoRoupa', 'Tamanho de roupa', 3),
  t('idiomas', 'Fala outro(s) idioma(s)? Caso sim, qual/quais?', 7),
  t('assento', 'Preferência de assento nos voos', 5),

  // Saúde
  t('tipoSanguineo', 'Tipo sanguíneo', 4),
  t('ultimoCheckup', 'Qual a data do seu último check-up?', 8),
  sn('seConsideraSaudavel', 'Você se considera saudável?', 6),
  sn('praticaAtividadeFisica', 'Você pratica atividade física com frequência?', 6),
  sn('sabeNadar', 'Você sabe nadar?', 6),
  { chave: 'condicionamentoFisico', rotulo: 'Condicionamento físico', tipo: 'opcoes', origem: null, opcoes: OPCOES_CONDICIONAMENTO, emLinha: true, colunas: 6 },
  { chave: 'diabetico', rotulo: 'Diabético(a)?', tipo: 'simNao', origem: null, colunas: 6 },
  { chave: 'disturbioCardioRespiratorio', rotulo: 'Distúrbio cardio-respiratório?', tipo: 'simNao', origem: null, colunas: 6 },
  sn('temRestricaoFisica', 'Você tem alguma restrição física, de mobilidade ou alguma condição que queira nos comunicar?'),
  m('restricaoFisicaDescricao', 'Por favor, descreva alguma restrição física ou de mobilidade:'),
  sn('temDoencaCronica', 'É portador(a) de alguma doença crônica ou patologia?'),
  m('doencaCronicaDescricao', 'Por favor, descreva sua doença crônica ou patologia:'),
  sn('usaMedicamento', 'Faz uso de medicamento contínuo?'),
  m('medicamentosDescricao', 'Por favor, descreva os medicamentos de uso contínuo:'),
  sn('fezCirurgia', 'Já fez alguma cirurgia?'),
  m('cirurgiaDescricao', 'Descreva o motivo e a data do procedimento'),
  sn('temQuestaoMedica', 'Há alguma questão médica relevante que queira nos comunicar?'),
  m('questaoMedicaDescricao', 'Por favor, descreva alguma questão médica relevante que queira nos comunicar:'),
  sn('temAlergia', 'Possui alergias?'),
  m('alergiasDescricao', 'Por favor, descreva suas alergias:'),
  t('vacinas', 'Vacinas que você já tomou:', 12),
  sn('acompanhamentoPsiquiatrico', 'Você fez acompanhamento psiquiátrico nos últimos 2 anos ou está atualmente em tratamento?'),
  sn('tratamentoOdontologico', 'Tratamento odontológico?'),

  // Alimentação
  sn('segueDieta', 'Você segue alguma dieta?'),
  m('alimentosNaoCome', 'Descreva alimentos que você não come por gosto, dieta ou restrição:'),
  m('restricoesAlimentaresDescricao', 'Por favor, detalhe ao máximo suas restrições alimentares'),
  m('alergiaAlimentarDescricao', 'Por favor, descreva alimentos que você tem alergia e não pode ingerir em hipótese alguma:'),
  sn('consomeAlcool', 'Você consome bebida alcoólica?'),

  // Outras informações
  m('comentarios', 'Comentários ou informações extras que considere necessários:'),
  sn('querCatalogoFisico', 'Gostaria de receber os nossos catálogos físicos?'),
  sn('enderecoPostalIgual', 'O endereço postal é o mesmo informado anteriormente?'),
] as const satisfies readonly CampoFicha[];

export type ChaveFicha = (typeof CAMPOS_FICHA)[number]['chave'];

export const CAMPO_POR_CHAVE = new Map<string, CampoFicha>(CAMPOS_FICHA.map((c) => [c.chave, c]));

/** Agrupamento visual. Toda chave de CAMPOS_FICHA aparece exatamente uma vez. */
export const SECOES_FICHA: SecaoFicha[] = [
  {
    titulo: 'Dados pessoais',
    linhas: [['nome', 'nascimento'], ['apelido', 'nacionalidade', 'estadoCivil'], ['cpf', 'rg', 'rne']],
  },
  {
    titulo: 'Contato',
    linhas: [['telefone', 'email'], ['preferenciaContato', 'comoConheceu'], ['agenciaNome', 'midiaOrigem']],
  },
  {
    titulo: 'Endereço',
    linhas: [['endereco', 'numero'], ['complemento', 'bairro'], ['cidade', 'estado', 'cep', 'pais']],
  },
  {
    titulo: 'Passaporte',
    linhas: [['passaporte', 'passaportePaisEmissor', 'passaporteEmissao', 'passaporteExpiracao'], ['temPassaporteEstrangeiro']],
  },
  {
    titulo: 'Contato de emergência',
    linhas: [['emergenciaNome', 'emergenciaParentesco'], ['emergenciaTelefone', 'emergenciaEmail']],
  },
  {
    titulo: 'Médico',
    linhas: [['medicoNome', 'medicoTelefone'], ['convenioMedico']],
  },
  {
    titulo: 'Informações para a viagem',
    linhas: [['altura', 'peso', 'calcado', 'tamanhoRoupa'], ['idiomas', 'assento']],
  },
  {
    titulo: 'Saúde',
    linhas: [
      ['tipoSanguineo', 'ultimoCheckup'],
      ['seConsideraSaudavel', 'praticaAtividadeFisica'],
      ['sabeNadar', 'condicionamentoFisico'],
      ['diabetico', 'disturbioCardioRespiratorio'],
      ['temRestricaoFisica'], ['restricaoFisicaDescricao'],
      ['temDoencaCronica'], ['doencaCronicaDescricao'],
      ['usaMedicamento'], ['medicamentosDescricao'],
      ['fezCirurgia'], ['cirurgiaDescricao'],
      ['temQuestaoMedica'], ['questaoMedicaDescricao'],
      ['temAlergia'], ['alergiasDescricao'],
      ['vacinas'],
      ['acompanhamentoPsiquiatrico'],
      ['tratamentoOdontologico'],
    ],
  },
  {
    titulo: 'Alimentação',
    linhas: [['segueDieta'], ['alimentosNaoCome'], ['restricoesAlimentaresDescricao'], ['alergiaAlimentarDescricao'], ['consomeAlcool']],
  },
  {
    titulo: 'Outras informações',
    linhas: [['comentarios'], ['querCatalogoFisico'], ['enderecoPostalIgual']],
  },
];
