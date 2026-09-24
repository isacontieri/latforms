# Catálogo das colunas do export do RD Station

Fonte: export real de 24/09/2026 (98 colunas). Implementar em `lib/rd/colunas.ts` como `COLUNAS_RD: readonly ColunaRd[]`, um item por coluna, **na ordem do CSV**:

```ts
type TipoColuna = 'texto' | 'maiusculas' | 'descricao' | 'email' | 'telefone' | 'data' | 'hora'
               | 'simNao' | 'cpf' | 'cep' | 'numero' | 'lista' | 'id';
type Grupo = 'Identificação' | 'Contato' | 'Documentos' | 'Endereço' | 'Emergência'
           | 'Saúde' | 'Alimentação' | 'Viagem' | 'Observações' | 'Comercial' | 'RD' | 'Interno';

interface ColunaRd {
  coluna: string;        // cabeçalho normalizado (trim + espaços colapsados)
  chave: string;         // chave estável em dados_rd.campos
  grupo: Grupo;          // agrupamento na tela do admin e na exportação
  tipo: TipoColuna;      // normalizador aplicado
  sensivel?: true;       // dado de saúde (LGPD art. 11)
  interno?: true;        // nunca aparece para o cliente
}
```

Regras:
- **Toda coluna do CSV é extraída.** Coluna do catálogo → `dados_rd.campos[chave]` normalizado. Coluna que não está no catálogo (o RD mudou o formulário) → `dados_rd.extras[cabeçalho]` como texto, e a prévia da importação avisa "coluna nova não catalogada: X". Nada é descartado.
- Coluna do catálogo ausente no CSV → aviso na prévia (não é erro).
- Várias colunas com a mesma `chave` (duplicatas do RD) → primeiro valor não vazio; se houver dois valores diferentes, `juntar(' — ', …)` e aviso.
- Comparar cabeçalhos depois de `normalize('NFC')` + trim + colapsar espaços. **Não** unificar `Nº` (U+00BA, ordinal) com `N°` (U+00B0, grau): o RD usa os dois em colunas diferentes (14 e 80).
- `Primeiro nome` não é confiável (às vezes vem o nome completo). Para a página do cliente, usar a primeira palavra de `nome`.

| # | Coluna (normalizada) | chave | grupo | tipo | uso na ficha PDF |
|---|---|---|---|---|---|
| 1 | Nome | `nome` | Identificação | texto | nomeCompleto |
| 2 | Empresa | `empresa` | Comercial | texto | — |
| 3 | Cargo | `cargo` | Identificação | texto | profissao |
| 4 | Email | `email` | Contato | email | email |
| 5 | Telefone | `telefone` | Contato | telefone | celular |
| 6 | Data de criação | `rdDataCriacao` | RD | data | — |
| 7 | Hora de criação | `rdHoraCriacao` | RD | hora | — |
| 8 | Contato e envio de comunicação | `rdBaseLegalComunicacao` | RD | texto | — |
| 9 | Status de contato e envio de comunicação | `rdStatusComunicacao` | RD | texto | — |
| 10 | Data de expiração do passaporte estrangeiro: | `passaporteEstrangeiroExpiracao` | Documentos | data | — |
| 11 | Veículo | `veiculo` | Comercial | texto | — |
| 12 | Agência | `agencia` | Comercial | texto | — |
| 13 | CPF | `cpf` | Documentos | cpf | cpf |
| 14 | Nº do passaporte | `passaporte` | Documentos | maiusculas | passaporte |
| 15 | RG | `rg` | Documentos | texto | rg |
| 16 | Nacionalidade | `nacionalidade` | Identificação | texto | nacionalidade |
| 17 | Bairro | `bairro` | Endereço | texto | bairro |
| 18 | CEP | `cep` | Endereço | cep | cep |
| 19 | Cidade | `cidade` | Endereço | texto | cidade |
| 20 | Estado | `estado` | Endereço | texto | estado |
| 21 | Primeiro nome | `primeiroNome` | Identificação | texto | — |
| 22 | Número | `numero` | Endereço | texto | numeroComplemento |
| 23 | País | `pais` | Endereço | texto | pais |
| 24 | Nome do contato (emergências) | `emergenciaNome` | Emergência | texto | contatoEmergencia |
| 25 | Grau de parentesco (emergências) | `emergenciaParentesco` | Emergência | texto | contatoEmergencia |
| 26 | E-mail (contato de emergência) | `emergenciaEmail` | Emergência | email | — |
| 27 | Altura | `altura` | Viagem | numero | — |
| 28 | Peso | `peso` | Viagem | numero | — |
| 29 | Nº de calçado (Brasil) | `calcado` | Viagem | texto | — |
| 30 | Tamanho de roupa | `tamanhoRoupa` | Viagem | texto | — |
| 31 | Preferência de assento nos voos | `assento` | Viagem | texto | — |
| 32 | Tipo sanguíneo | `tipoSanguineo` | Saúde | texto | tipoSanguineo |
| 33 | É portador(a) de alguma doença crônica ou patologia? | `temDoencaCronica` | Saúde | simNao 🔒 | antecedentesClinicos |
| 34 | Faz uso de medicamento contínuo? | `usaMedicamento` | Saúde | simNao 🔒 | medicamentoRegular |
| 35 | Você pratica atividade física com frequência? | `praticaAtividadeFisica` | Saúde | simNao 🔒 | — (não inferir condicionamento) |
| 36 | data nascimento | `nascimento` | Identificação | data | nascimento |
| 37 | Se conheceu por mídia digital ou impresso, qual | `midiaOrigem` | Comercial | texto | — |
| 38 | Complemento | `complemento` | Endereço | texto | numeroComplemento |
| 39 | País emissor: | `passaportePaisEmissor` | Documentos | texto | — |
| 40 | País emissor do passaporte estrangeiro: | `passaporteEstrangeiroPaisEmissor` | Documentos | texto | — |
| 41 | Nome do médico (emergências) | `medicoNome` | Emergência | texto | — |
| 42 | Telefone do médico (emergências) | `medicoTelefone` | Emergência | telefone | — |
| 43 | Comentário ou infos extras | `comentarios` | Observações | descricao | outrasObservacoes |
| 44 | Comentários ou informações extras que considere necessários | `comentarios` (duplicata) | Observações | descricao | outrasObservacoes |
| 45 | Como gostaria de ser chamada(0) durante a viagem? | `apelido` | Identificação | texto | outrasObservacoes |
| 46 | Gostaria de receber os nossos catálogos físicos? | `querCatalogoFisico` | Comercial | simNao | — |
| 47 | Descreva alimentos que você não come por gosto, dieta ou restrição | `alimentosNaoCome` | Alimentação | descricao | descricaoRestricoes |
| 48 | Qual é a data do seu último check-up? | `ultimoCheckup` | Saúde | data 🔒 | — |
| 49 | RNE | `rne` | Documentos | texto | — |
| 50 | Possui alergias? | `temAlergia` | Saúde | simNao 🔒 | alergias |
| 51 | Endereço | `endereco` | Endereço | texto | endereco |
| 52 | Você tem alguma restrição física, de mobilidade ou alguma condição que queira nos comunicar? | `temRestricaoFisica` | Saúde | simNao 🔒 | — |
| 53 | Você consome bebida alcoólica? | `consomeAlcool` | Saúde | simNao 🔒 | — |
| 54 | Você se considera saudável? | `seConsideraSaudavel` | Saúde | simNao 🔒 | — |
| 55 | Você sabe nadar? | `sabeNadar` | Saúde | simNao | sabeNadar |
| 56 | Por favor, descreva alimentos que você tem alergia e não pode ingerir em hipótese alguma: | `alergiaAlimentarDescricao` | Alimentação | descricao 🔒 | alergias |
| 57 | Tratamento odontológico? | `tratamentoOdontologico` | Saúde | simNao 🔒 | — |
| 58 | Você fez acompanhamento psiquiátrico nos últimos 2 anos ou está atualmente em tratamento? | `acompanhamentoPsiquiatrico` | Saúde | simNao 🔒 | — |
| 59 | Já fez alguma cirurgia? | `fezCirurgia` | Saúde | simNao 🔒 | antecedentesClinicos |
| 60 | Declaração de Veracidade das informações | `declaracaoVeracidade` | RD | texto | — |
| 61 | Como conheceu a Latitudes? | `comoConheceu` | Comercial | texto | — |
| 62 | Caso tenha sido através de uma agência de viagens, por favor indique o nome: | `agenciaNome` | Comercial | texto | — |
| 63 | Vacinas que você já tomou | `vacinas` | Saúde | lista 🔒 | vacina* |
| 64 | Fala outros idiomas? | `idiomas` | Viagem | lista | — |
| 65 | Como prefere ser contatada(o): | `preferenciaContato` | Contato | texto | — |
| 66 | Informe o endereço completo para entrega | `enderecoEntrega` | Endereço | texto | — |
| 67 | Por favor, detalhe ao máximo suas restrições alimentares | `restricoesAlimentaresDescricao` | Alimentação | descricao | descricaoRestricoes |
| 68 | Descreva o motivo e a data do procedimento | `cirurgiaDescricao` | Saúde | descricao 🔒 | antecedentesClinicos |
| 69 | Há alguma questão médica relevante que queira nos comunicar? | `temQuestaoMedica` | Saúde | simNao 🔒 | antecedentesClinicos |
| 70 | Data de emissão do passaporte estrangeiro: | `passaporteEstrangeiroEmissao` | Documentos | data | — |
| 71 | Data de emissão: | `passaporteEmissao` | Documentos | data | — |
| 72 | Data de expiração: | `passaporteExpiracao` | Documentos | data | vencimentoPassaporte |
| 73 | O endereço postal é o mesmo informado anteriormente? | `enderecoPostalIgual` | Endereço | simNao | — |
| 74 | Possui passaporte estrangeiro? | `temPassaporteEstrangeiro` | Documentos | simNao | — |
| 75 | Por favor, descreva alguma restrição física ou de mobilidade: | `restricaoFisicaDescricao` | Saúde | descricao 🔒 | outrasObservacoes |
| 76 | Por favor, descreva sua doença crônica ou patologia: | `doencaCronicaDescricao` | Saúde | descricao 🔒 | antecedentesClinicos |
| 77 | Por favor, descreva os medicamentos de uso contínuo: | `medicamentosDescricao` | Saúde | descricao 🔒 | medicamentoRegular |
| 78 | Por favor, descreva alguma questão médica relevante que queira nos comunicar: | `questaoMedicaDescricao` | Saúde | descricao 🔒 | antecedentesClinicos |
| 79 | Observações para uso interno | `observacoesInternas` | Interno | texto ⛔ | — **nunca** vai ao cliente |
| 80 | N° Passaporte estrangeiro | `passaporteEstrangeiroNumero` | Documentos | maiusculas | — |
| 81 | Telefone de contato (emergências) | `emergenciaTelefone` | Emergência | telefone | telefoneEmergencia |
| 82 | Você segue alguma dieta? | `segueDieta` | Alimentação | simNao | restricoesAlimentares |
| 83 | Seleciona a data na qual irá comparecer | `dataComparecimento` | Viagem | data | — |
| 84 | Gostaria de fazer alguma observação ou solicitação extra? | `observacaoExtra` | Observações | descricao | outrasObservacoes |
| 85 | Qual o aeroporto de origem? | `aeroportoOrigem` | Viagem | texto | — |
| 86 | Você irá levar acompanhante na viagem? | `levaAcompanhante` | Viagem | simNao | — |
| 87 | Gênero | `genero` | Identificação | texto | — |
| 88 | Por favor, descreva suas alergias: | `alergiasDescricao` | Saúde | descricao 🔒 | alergias |
| 89 | Qual o nome da sua distribuidora/empresa? | `distribuidora` | Comercial | texto | — |
| 90 | Indique o nome de seu(s)/sua(s) acompanhante(s): | `acompanhantes` | Viagem | texto | — |
| 91 | Sua inscrição refere-se a: | `tipoInscricao` | Viagem | texto | — |
| 92 | Você possui certificado de vacinação contra a COVID-19? | `temCertificadoCovid` | Saúde | simNao 🔒 | vacinaCovid |
| 93 | Qual dieta? | `qualDieta` | Alimentação | descricao | descricaoRestricoes |
| 94 | Estado: | `estado` (duplicata) | Endereço | texto | estado |
| 95 | Segue alguma dieta? | `segueDieta` (duplicata) | Alimentação | simNao | restricoesAlimentares |
| 96 | Caso tenha sido através de mídia digital ou impressa, por favor especifique qual: | `midiaOrigem` (duplicata) | Comercial | texto | — |
| 97 | ID | `rdId` | RD | id | — (chave do upsert) |
| 98 | ID da Empresa | `rdEmpresaId` | RD | id | — |

🔒 = `sensivel: true` (dado de saúde). ⛔ = `interno: true`.

Onde esses dados aparecem:
- **Admin → cliente:** todas as chaves, agrupadas por `grupo`, com os campos vazios recolhidos. `extras` aparece num bloco "Outras colunas do RD".
- **Exportação CSV:** uma coluna por `chave` (na ordem do catálogo), mais `extras` e os campos de `dados_respondidos`. Exportar dados 🔒 grava `acao = 'exportar_sensivel'` na `auditoria`.
- **PDF do cliente:** só o que o mapeamento da skill (§4) leva para os 35 campos do template. O restante não tem lugar no modelo atual; para aparecer no PDF, é preciso adicionar campos ao template no Scribus.
