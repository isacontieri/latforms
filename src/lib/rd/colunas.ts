/**
 * Catálogo de todas as colunas do export do RD Station, na ordem do CSV.
 * Documentação: .claude/skills/ficha-cadastro-latitudes/colunas-rd.md
 */

export type TipoColuna =
  | 'texto' | 'maiusculas' | 'descricao' | 'email' | 'telefone' | 'data' | 'hora'
  | 'simNao' | 'cpf' | 'cep' | 'numero' | 'lista' | 'id';

export type Grupo =
  | 'Identificação' | 'Contato' | 'Documentos' | 'Endereço' | 'Emergência'
  | 'Saúde' | 'Alimentação' | 'Viagem' | 'Observações' | 'Comercial' | 'RD' | 'Interno';

export interface ColunaRd {
  /** Cabeçalho normalizado (NFC + trim + espaços colapsados). */
  coluna: string;
  chave: string;
  grupo: Grupo;
  tipo: TipoColuna;
  /** Dado de saúde (LGPD art. 11). */
  sensivel?: true;
  /** Nunca aparece para o cliente. */
  interno?: true;
}

export const COLUNAS_RD = [
  { coluna: 'Nome', chave: 'nome', grupo: 'Identificação', tipo: 'texto' },
  { coluna: 'Empresa', chave: 'empresa', grupo: 'Comercial', tipo: 'texto' },
  { coluna: 'Cargo', chave: 'cargo', grupo: 'Identificação', tipo: 'texto' },
  { coluna: 'Email', chave: 'email', grupo: 'Contato', tipo: 'email' },
  { coluna: 'Telefone', chave: 'telefone', grupo: 'Contato', tipo: 'telefone' },
  { coluna: 'Data de criação', chave: 'rdDataCriacao', grupo: 'RD', tipo: 'data' },
  { coluna: 'Hora de criação', chave: 'rdHoraCriacao', grupo: 'RD', tipo: 'hora' },
  { coluna: 'Contato e envio de comunicação', chave: 'rdBaseLegalComunicacao', grupo: 'RD', tipo: 'texto' },
  { coluna: 'Status de contato e envio de comunicação', chave: 'rdStatusComunicacao', grupo: 'RD', tipo: 'texto' },
  { coluna: 'Data de expiração do passaporte estrangeiro:', chave: 'passaporteEstrangeiroExpiracao', grupo: 'Documentos', tipo: 'data' },
  { coluna: 'Veículo', chave: 'veiculo', grupo: 'Comercial', tipo: 'texto' },
  { coluna: 'Agência', chave: 'agencia', grupo: 'Comercial', tipo: 'texto' },
  { coluna: 'CPF', chave: 'cpf', grupo: 'Documentos', tipo: 'cpf' },
  { coluna: 'Nº do passaporte', chave: 'passaporte', grupo: 'Documentos', tipo: 'maiusculas' },
  { coluna: 'RG', chave: 'rg', grupo: 'Documentos', tipo: 'texto' },
  { coluna: 'Nacionalidade', chave: 'nacionalidade', grupo: 'Identificação', tipo: 'texto' },
  { coluna: 'Bairro', chave: 'bairro', grupo: 'Endereço', tipo: 'texto' },
  { coluna: 'CEP', chave: 'cep', grupo: 'Endereço', tipo: 'cep' },
  { coluna: 'Cidade', chave: 'cidade', grupo: 'Endereço', tipo: 'texto' },
  { coluna: 'Estado', chave: 'estado', grupo: 'Endereço', tipo: 'texto' },
  { coluna: 'Primeiro nome', chave: 'primeiroNome', grupo: 'Identificação', tipo: 'texto' },
  { coluna: 'Número', chave: 'numero', grupo: 'Endereço', tipo: 'texto' },
  { coluna: 'País', chave: 'pais', grupo: 'Endereço', tipo: 'texto' },
  { coluna: 'Nome do contato (emergências)', chave: 'emergenciaNome', grupo: 'Emergência', tipo: 'texto' },
  { coluna: 'Grau de parentesco (emergências)', chave: 'emergenciaParentesco', grupo: 'Emergência', tipo: 'texto' },
  { coluna: 'E-mail (contato de emergência)', chave: 'emergenciaEmail', grupo: 'Emergência', tipo: 'email' },
  { coluna: 'Altura', chave: 'altura', grupo: 'Viagem', tipo: 'numero' },
  { coluna: 'Peso', chave: 'peso', grupo: 'Viagem', tipo: 'numero' },
  { coluna: 'Nº de calçado (Brasil)', chave: 'calcado', grupo: 'Viagem', tipo: 'texto' },
  { coluna: 'Tamanho de roupa', chave: 'tamanhoRoupa', grupo: 'Viagem', tipo: 'texto' },
  { coluna: 'Preferência de assento nos voos', chave: 'assento', grupo: 'Viagem', tipo: 'texto' },
  { coluna: 'Tipo sanguíneo', chave: 'tipoSanguineo', grupo: 'Saúde', tipo: 'texto' },
  { coluna: 'É portador(a) de alguma doença crônica ou patologia?', chave: 'temDoencaCronica', grupo: 'Saúde', tipo: 'simNao', sensivel: true },
  { coluna: 'Faz uso de medicamento contínuo?', chave: 'usaMedicamento', grupo: 'Saúde', tipo: 'simNao', sensivel: true },
  { coluna: 'Você pratica atividade física com frequência?', chave: 'praticaAtividadeFisica', grupo: 'Saúde', tipo: 'simNao', sensivel: true },
  { coluna: 'data nascimento', chave: 'nascimento', grupo: 'Identificação', tipo: 'data' },
  { coluna: 'Se conheceu por mídia digital ou impresso, qual', chave: 'midiaOrigem', grupo: 'Comercial', tipo: 'texto' },
  { coluna: 'Complemento', chave: 'complemento', grupo: 'Endereço', tipo: 'texto' },
  { coluna: 'País emissor:', chave: 'passaportePaisEmissor', grupo: 'Documentos', tipo: 'texto' },
  { coluna: 'País emissor do passaporte estrangeiro:', chave: 'passaporteEstrangeiroPaisEmissor', grupo: 'Documentos', tipo: 'texto' },
  { coluna: 'Nome do médico (emergências)', chave: 'medicoNome', grupo: 'Emergência', tipo: 'texto' },
  { coluna: 'Telefone do médico (emergências)', chave: 'medicoTelefone', grupo: 'Emergência', tipo: 'telefone' },
  { coluna: 'Comentário ou infos extras', chave: 'comentarios', grupo: 'Observações', tipo: 'descricao' },
  { coluna: 'Comentários ou informações extras que considere necessários', chave: 'comentarios', grupo: 'Observações', tipo: 'descricao' },
  { coluna: 'Como gostaria de ser chamada(0) durante a viagem?', chave: 'apelido', grupo: 'Identificação', tipo: 'texto' },
  { coluna: 'Gostaria de receber os nossos catálogos físicos?', chave: 'querCatalogoFisico', grupo: 'Comercial', tipo: 'simNao' },
  { coluna: 'Descreva alimentos que você não come por gosto, dieta ou restrição', chave: 'alimentosNaoCome', grupo: 'Alimentação', tipo: 'descricao' },
  { coluna: 'Qual é a data do seu último check-up?', chave: 'ultimoCheckup', grupo: 'Saúde', tipo: 'data', sensivel: true },
  { coluna: 'RNE', chave: 'rne', grupo: 'Documentos', tipo: 'texto' },
  { coluna: 'Possui alergias?', chave: 'temAlergia', grupo: 'Saúde', tipo: 'simNao', sensivel: true },
  { coluna: 'Endereço', chave: 'endereco', grupo: 'Endereço', tipo: 'texto' },
  { coluna: 'Você tem alguma restrição física, de mobilidade ou alguma condição que queira nos comunicar?', chave: 'temRestricaoFisica', grupo: 'Saúde', tipo: 'simNao', sensivel: true },
  { coluna: 'Você consome bebida alcoólica?', chave: 'consomeAlcool', grupo: 'Saúde', tipo: 'simNao', sensivel: true },
  { coluna: 'Você se considera saudável?', chave: 'seConsideraSaudavel', grupo: 'Saúde', tipo: 'simNao', sensivel: true },
  { coluna: 'Você sabe nadar?', chave: 'sabeNadar', grupo: 'Saúde', tipo: 'simNao' },
  { coluna: 'Por favor, descreva alimentos que você tem alergia e não pode ingerir em hipótese alguma:', chave: 'alergiaAlimentarDescricao', grupo: 'Alimentação', tipo: 'descricao', sensivel: true },
  { coluna: 'Tratamento odontológico?', chave: 'tratamentoOdontologico', grupo: 'Saúde', tipo: 'simNao', sensivel: true },
  { coluna: 'Você fez acompanhamento psiquiátrico nos últimos 2 anos ou está atualmente em tratamento?', chave: 'acompanhamentoPsiquiatrico', grupo: 'Saúde', tipo: 'simNao', sensivel: true },
  { coluna: 'Já fez alguma cirurgia?', chave: 'fezCirurgia', grupo: 'Saúde', tipo: 'simNao', sensivel: true },
  { coluna: 'Declaração de Veracidade das informações', chave: 'declaracaoVeracidade', grupo: 'RD', tipo: 'texto' },
  { coluna: 'Como conheceu a Latitudes?', chave: 'comoConheceu', grupo: 'Comercial', tipo: 'texto' },
  { coluna: 'Caso tenha sido através de uma agência de viagens, por favor indique o nome:', chave: 'agenciaNome', grupo: 'Comercial', tipo: 'texto' },
  { coluna: 'Vacinas que você já tomou', chave: 'vacinas', grupo: 'Saúde', tipo: 'lista', sensivel: true },
  { coluna: 'Fala outros idiomas?', chave: 'idiomas', grupo: 'Viagem', tipo: 'lista' },
  { coluna: 'Como prefere ser contatada(o):', chave: 'preferenciaContato', grupo: 'Contato', tipo: 'texto' },
  { coluna: 'Informe o endereço completo para entrega', chave: 'enderecoEntrega', grupo: 'Endereço', tipo: 'texto' },
  { coluna: 'Por favor, detalhe ao máximo suas restrições alimentares', chave: 'restricoesAlimentaresDescricao', grupo: 'Alimentação', tipo: 'descricao' },
  { coluna: 'Descreva o motivo e a data do procedimento', chave: 'cirurgiaDescricao', grupo: 'Saúde', tipo: 'descricao', sensivel: true },
  { coluna: 'Há alguma questão médica relevante que queira nos comunicar?', chave: 'temQuestaoMedica', grupo: 'Saúde', tipo: 'simNao', sensivel: true },
  { coluna: 'Data de emissão do passaporte estrangeiro:', chave: 'passaporteEstrangeiroEmissao', grupo: 'Documentos', tipo: 'data' },
  { coluna: 'Data de emissão:', chave: 'passaporteEmissao', grupo: 'Documentos', tipo: 'data' },
  { coluna: 'Data de expiração:', chave: 'passaporteExpiracao', grupo: 'Documentos', tipo: 'data' },
  { coluna: 'O endereço postal é o mesmo informado anteriormente?', chave: 'enderecoPostalIgual', grupo: 'Endereço', tipo: 'simNao' },
  { coluna: 'Possui passaporte estrangeiro?', chave: 'temPassaporteEstrangeiro', grupo: 'Documentos', tipo: 'simNao' },
  { coluna: 'Por favor, descreva alguma restrição física ou de mobilidade:', chave: 'restricaoFisicaDescricao', grupo: 'Saúde', tipo: 'descricao', sensivel: true },
  { coluna: 'Por favor, descreva sua doença crônica ou patologia:', chave: 'doencaCronicaDescricao', grupo: 'Saúde', tipo: 'descricao', sensivel: true },
  { coluna: 'Por favor, descreva os medicamentos de uso contínuo:', chave: 'medicamentosDescricao', grupo: 'Saúde', tipo: 'descricao', sensivel: true },
  { coluna: 'Por favor, descreva alguma questão médica relevante que queira nos comunicar:', chave: 'questaoMedicaDescricao', grupo: 'Saúde', tipo: 'descricao', sensivel: true },
  { coluna: 'Observações para uso interno', chave: 'observacoesInternas', grupo: 'Interno', tipo: 'texto', interno: true },
  { coluna: 'N° Passaporte estrangeiro', chave: 'passaporteEstrangeiroNumero', grupo: 'Documentos', tipo: 'maiusculas' },
  { coluna: 'Telefone de contato (emergências)', chave: 'emergenciaTelefone', grupo: 'Emergência', tipo: 'telefone' },
  { coluna: 'Você segue alguma dieta?', chave: 'segueDieta', grupo: 'Alimentação', tipo: 'simNao' },
  { coluna: 'Seleciona a data na qual irá comparecer', chave: 'dataComparecimento', grupo: 'Viagem', tipo: 'data' },
  { coluna: 'Gostaria de fazer alguma observação ou solicitação extra?', chave: 'observacaoExtra', grupo: 'Observações', tipo: 'descricao' },
  { coluna: 'Qual o aeroporto de origem?', chave: 'aeroportoOrigem', grupo: 'Viagem', tipo: 'texto' },
  { coluna: 'Você irá levar acompanhante na viagem?', chave: 'levaAcompanhante', grupo: 'Viagem', tipo: 'simNao' },
  { coluna: 'Gênero', chave: 'genero', grupo: 'Identificação', tipo: 'texto' },
  { coluna: 'Por favor, descreva suas alergias:', chave: 'alergiasDescricao', grupo: 'Saúde', tipo: 'descricao', sensivel: true },
  { coluna: 'Qual o nome da sua distribuidora/empresa?', chave: 'distribuidora', grupo: 'Comercial', tipo: 'texto' },
  { coluna: 'Indique o nome de seu(s)/sua(s) acompanhante(s):', chave: 'acompanhantes', grupo: 'Viagem', tipo: 'texto' },
  { coluna: 'Sua inscrição refere-se a:', chave: 'tipoInscricao', grupo: 'Viagem', tipo: 'texto' },
  { coluna: 'Você possui certificado de vacinação contra a COVID-19?', chave: 'temCertificadoCovid', grupo: 'Saúde', tipo: 'simNao', sensivel: true },
  { coluna: 'Qual dieta?', chave: 'qualDieta', grupo: 'Alimentação', tipo: 'descricao' },
  { coluna: 'Estado:', chave: 'estado', grupo: 'Endereço', tipo: 'texto' },
  { coluna: 'Segue alguma dieta?', chave: 'segueDieta', grupo: 'Alimentação', tipo: 'simNao' },
  { coluna: 'Caso tenha sido através de mídia digital ou impressa, por favor especifique qual:', chave: 'midiaOrigem', grupo: 'Comercial', tipo: 'texto' },
  { coluna: 'ID', chave: 'rdId', grupo: 'RD', tipo: 'id' },
  { coluna: 'ID da Empresa', chave: 'rdEmpresaId', grupo: 'RD', tipo: 'id' },
] as const satisfies readonly ColunaRd[];

export type ChaveRd = (typeof COLUNAS_RD)[number]['chave'];

export type ValorCampo = string | number | string[] | null;
export type CamposRd = Record<ChaveRd, ValorCampo>;

/** Chaves únicas, na ordem do CSV (duplicatas do RD aparecem uma vez). */
export const CHAVES_RD: readonly ChaveRd[] = [...new Set(COLUNAS_RD.map((c) => c.chave))];

export function normalizarCabecalho(h: string): string {
  return h.normalize('NFC').replace(/\s+/g, ' ').trim();
}

const PORCOLUNA = new Map<string, ColunaRd>(COLUNAS_RD.map((c) => [normalizarCabecalho(c.coluna), c]));

export function colunaDoCatalogo(cabecalho: string): ColunaRd | undefined {
  return PORCOLUNA.get(normalizarCabecalho(cabecalho));
}
