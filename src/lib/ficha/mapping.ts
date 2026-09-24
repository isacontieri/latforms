import type { CamposRd, ChaveRd } from '@/lib/rd/colunas';
import { juntar, semAcento } from './normalizers';
import { DadosFichaSchema, type DadosFicha } from './schema';

/**
 * Mapeia `dados_rd.campos` para os 35 campos da ficha em PDF.
 * Campos sem fonte no CSV ficam `null` para o cliente preencher; dado de saúde nunca é inferido.
 */
export function mapearParaFicha(c: CamposRd): DadosFicha {
  const s = (k: ChaveRd): string | null => {
    const v = c[k];
    return typeof v === 'string' ? v : null;
  };
  const sn = (k: ChaveRd): 'Sim' | 'Não' | null => {
    const v = s(k);
    return v === 'Sim' || v === 'Não' ? v : null;
  };
  const prefixo = (p: string, v: string | null) => (v ? p + v : null);

  const nacionalidade = s('nacionalidade');
  const pais = s('pais') ?? (nacionalidade && semAcento(nacionalidade).startsWith('brasileir') ? 'Brasil' : null);

  const emergenciaNome = s('emergenciaNome');
  const parentesco = s('emergenciaParentesco');
  const contatoEmergencia = emergenciaNome && parentesco ? `${emergenciaNome} (${parentesco})` : emergenciaNome;

  const medicamentoRegular = s('medicamentosDescricao') ?? sn('usaMedicamento');

  const alergias =
    juntar(' — ', s('alergiasDescricao'), prefixo('Alimentar: ', s('alergiaAlimentarDescricao'))) ?? sn('temAlergia');

  const antecedentesDescritos = juntar(
    ' — ',
    s('doencaCronicaDescricao'),
    prefixo('Cirurgia: ', s('cirurgiaDescricao')),
    s('questaoMedicaDescricao'),
  );
  const negouTudo = [sn('temDoencaCronica'), sn('fezCirurgia'), sn('temQuestaoMedica')].every((r) => r === 'Não');
  const antecedentesClinicos = antecedentesDescritos ?? (negouTudo ? 'Não' : null);

  const descricaoRestricoes = juntar(
    ' — ',
    prefixo('Dieta: ', s('qualDieta')),
    s('restricoesAlimentaresDescricao'),
    s('alimentosNaoCome'),
  );
  const segueDieta = sn('segueDieta');
  const restricoesAlimentares =
    segueDieta === 'Sim' || descricaoRestricoes ? 'Sim' : segueDieta === 'Não' ? 'Não' : null;

  const vacinas = (Array.isArray(c.vacinas) ? c.vacinas : []).map(semAcento);
  const tomou = (re: RegExp) => vacinas.some((v) => re.test(v));

  return DadosFichaSchema.parse({
    nomeCompleto: s('nome'),
    nascimento: s('nascimento'),
    cpf: s('cpf'),
    rg: s('rg'),
    passaporte: s('passaporte'),
    vencimentoPassaporte: s('passaporteExpiracao'),
    nacionalidade,
    cep: s('cep'),
    endereco: s('endereco'),
    numeroComplemento: juntar(' / ', s('numero'), s('complemento')),
    bairro: s('bairro'),
    cidade: s('cidade'),
    estado: s('estado'),
    pais,
    celular: s('telefone'),
    email: s('email'),
    profissao: s('cargo'),
    estadoCivil: null,
    contatoEmergencia,
    telefoneEmergencia: s('emergenciaTelefone'),
    medicamentoRegular,
    alergias,
    tipoSanguineo: s('tipoSanguineo')?.replace(/\s+/g, '').toUpperCase() || null,
    convenioMedico: null,
    antecedentesClinicos,
    condicionamentoFisico: null,
    sabeNadar: sn('sabeNadar'),
    diabetico: null,
    disturbioCardioRespiratorio: null,
    restricoesAlimentares,
    descricaoRestricoes,
    vacinaTetano: tomou(/tetan|\bdtp?a?\b/),
    vacinaFebreAmarela: tomou(/febre amarela/),
    vacinaCovid: tomou(/covid/) || sn('temCertificadoCovid') === 'Sim',
    outrasObservacoes: juntar(
      '\n',
      s('comentarios'),
      prefixo('Mobilidade: ', s('restricaoFisicaDescricao')),
      s('observacaoExtra'),
      prefixo('Prefere ser chamado(a): ', s('apelido')),
    ),
  });
}
