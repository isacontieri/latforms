import type { DadosFicha } from '../schema';

/**
 * Nomes internos dos campos no template (Scribus). Genéricos — conferidos no template em 24/09/2026.
 * Ver skill ficha-cadastro-latitudes §5.
 */
export const CAMPOS_PDF = {
  nomeCompleto: 'Copiar de Campo de texto20 (2)',
  nascimento: 'Copiar de Campo de texto20 (17)', // JS do Acrobat: data dd/mm/yyyy
  cpf: 'Campo de texto20',
  rg: 'Copiar de Campo de texto20 (14)',
  passaporte: 'Copiar de Campo de texto20',
  vencimentoPassaporte: 'Copiar de Campo de texto20 (13)', // JS do Acrobat: data dd/mm/yyyy
  nacionalidade: 'Copiar de Campo de texto20 (25)',
  cep: 'Copiar de Campo de texto20 (3)',
  endereco: 'Copiar de Campo de texto20 (4)',
  numeroComplemento: 'Copiar de Campo de texto20 (5)',
  bairro: 'Copiar de Campo de texto20 (6)',
  cidade: 'Copiar de Campo de texto20 (7)',
  estado: 'Copiar de Campo de texto20 (8)',
  pais: 'Copiar de Campo de texto20 (9)',
  celular: 'Copiar de Campo de texto20 (10)',
  email: 'Copiar de Campo de texto20 (11)',
  profissao: 'Copiar de Campo de texto20 (15)',
  estadoCivil: 'Lista suspensa58',
  contatoEmergencia: 'Copiar de Campo de texto20 (16)',
  telefoneEmergencia: 'Copiar de Campo de texto20 (18)',
  medicamentoRegular: 'Copiar de Campo de texto20 (19)',
  alergias: 'Copiar de Campo de texto20 (20)',
  tipoSanguineo: 'Copiar de Campo de texto20 (21)',
  convenioMedico: 'Copiar de Campo de texto20 (22)',
  antecedentesClinicos: 'Copiar de Campo de texto20 (23)',
  condicionamentoFisico: 'Copiar de Lista suspensa58',
  sabeNadar: 'Copiar de Lista suspensa58 (2)',
  diabetico: 'Copiar de Lista suspensa58 (3)',
  disturbioCardioRespiratorio: 'Copiar de Lista suspensa58 (4)',
  restricoesAlimentares: 'Copiar de Lista suspensa58 (5)',
  descricaoRestricoes: 'Copiar de Campo de texto20 (24)',
  vacinaTetano: 'Caixa de seleção101',
  vacinaFebreAmarela: 'Copiar de Caixa de seleção101',
  vacinaCovid: 'Copiar de Caixa de seleção101 (2)',
  outrasObservacoes: 'Copiar de Campo de texto20 (26)',
} as const satisfies Record<keyof DadosFicha, string>;

export const PLACEHOLDER_DROPDOWN = '---Selecione---';

export const CAMINHO_TEMPLATE = 'assets/templates/ficha-cadastro-2024.pdf';
