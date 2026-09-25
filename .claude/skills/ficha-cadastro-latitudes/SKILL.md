---
name: ficha-cadastro-latitudes
description: Regras de domínio do LatForms, o motor de fichas da Latitudes — parse do CSV exportado do RD Station, normalizadores, mapeamento para a Ficha de Cadastro 2024 (PDF AcroForm), preenchimento/leitura com pdf-lib, upload do cliente, tokens por URL, ciclo de status da ficha, área dos funcionários, cron e backup. Use ao mexer em importação de CSV, mapeamento de campos, geração ou leitura do PDF, tokens, rotas /f/[token], status da ficha, cron ou backup.
---

# LatForms — regras de domínio

Restrições de custo zero e regras invioláveis estão no `CLAUDE.md` da raiz e valem sempre. Plano completo em `PLANO_IMPLEMENTACAO.md`.

## 1. Parse do CSV do RD Station (`lib/rd/parse-csv.ts`)

Roda **no navegador** (a importação lê o arquivo localmente e envia lotes de até 200 linhas em JSON para `/api/importacoes/[id]/lote`). Normalização e mapeamento rodam no servidor, que revalida tudo.

- Encoding: decodificar com `new TextDecoder('utf-8', { fatal: true })`; se lançar erro, decodificar como `windows-1252`.
- Remover o BOM (`﻿`) **antes** de olhar a primeira linha.
- **A primeira linha é `sep=,`** → remover se começar com `sep=` e usar o caractere após `=` como delimitador.
- `papaparse` com `header: true`, `skipEmptyLines: 'greedy'`, `transformHeader` normalizando o cabeçalho.
- **Normalizar cabeçalhos**: `h.replace(/\s+/g, ' ').trim()`. Existem cabeçalhos com espaço inicial e espaços duplos (ex.: `" Por favor, descreva  os medicamentos de uso contínuo:"`).
- Se dois cabeçalhos ficarem iguais depois de normalizados, **combinar** os valores (primeiro não vazio) em vez de aceitar o `_1` que o papaparse cria.
- Normalizar valores: trim; `""`, `"n/a"`, `"N/A"`, `"-"` → `null`.
- Chave única do contato: coluna **`ID`** (ID do RD). Linha sem `ID` → erro de linha, não aborta a importação.
- `clientes.nome` é obrigatório: se `Nome` vier vazio, usar o e-mail; se também vazio, `'(sem nome)'` + aviso.

### Extração de todas as colunas (`lib/rd/colunas.ts`, `lib/rd/extrair.ts`)

**Todas as colunas do CSV são extraídas e guardadas** — não só as que vão para o PDF. O catálogo completo das 98 colunas (chave, grupo, tipo, dado sensível) está em [colunas-rd.md](colunas-rd.md); ler esse arquivo antes de mexer na extração, na tela do cliente no admin ou na exportação.

`clientes.dados_rd` (jsonb):
```ts
{
  campos: Record<ChaveRd, string | number | boolean | string[] | null>, // catálogo, já normalizado
  extras: Record<string, string>,   // colunas que o catálogo não conhece (nada é descartado)
  original: Record<string, string>, // linha bruta (cabeçalho normalizado → valor), para reprocessar
}
```
O mapeamento para a ficha (§4) lê de `dados_rd.campos`, nunca direto do CSV.

## 2. Normalizadores (`lib/ficha/normalizers.ts`)

| Função | Regra |
|---|---|
| `data(v)` | Aceita `AAAA-MM-DD`, `DD/MM/AAAA`, `D/M/AAAA`, `DD/MM/AA` (AA ≤ ano atual → 20AA, senão 19AA) → saída `DD/MM/AAAA`. Inválida → `null` + aviso |
| `cpf(v)` | Só dígitos; se 11 dígitos → `000.000.000-00`, e se os dígitos verificadores não baterem → aviso; senão mantém original + aviso |
| `cep(v)` | Só dígitos; se 8 → `00000-000` |
| `telefone(v)` | Pode vir `"+55 (19) 99635-4014;019996354014"` → usar o **primeiro** antes de `;`. Brasileiro (tem `+55`, ou 10–11 dígitos, ou 11–12 começando com `0`): remover `+55` e o zero de operadora e formatar `(DD) 90000-0000` (celular) ou `(DD) 0000-0000` (fixo). Outro país (`+` diferente de `+55`): manter como veio |
| `simNao(v)` | `sim`, `s`, `yes`, `Sim!` → `'Sim'`; `nao`, `não`, `n`, `Não!` → `'Não'`; outro → `null` (comparar sem acento, minúsculo, sem pontuação) |
| `juntar(sep, ...partes)` | Remove nulos/vazios/duplicados e une com `sep`. Padrão da ficha: `' — '` |
| `texto(v)` | Trim e colapsa espaços |
| `maiusculas(v)` | `texto` + maiúsculas |
| `descricao(v)` | `texto`, mas se o valor inteiro for só uma resposta sim/não (`simNao(v) !== null`, ex.: `Não!`, `sim`) → `null`. Usado nas colunas de texto livre, para "Não!" não virar observação |
| `email(v)` | `texto` + minúsculas |
| `numero(v)` | Aceita vírgula decimal (`1,65` → `1.65`); inválido → `null` + aviso |
| `hora(v)` | `HH:MM` |
| `lista(v)` | Separa por `,` ou `;` → `string[]` com `texto` em cada item (ex.: vacinas, idiomas) |
| `semAcento(v)` | `v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()` (usado nas comparações) |

## 3. Tipo `DadosFicha` (`lib/ficha/schema.ts`)

```ts
export const OPCOES = {
  estadoCivil: ['Solteiro', 'Casado', 'Separado', 'Divorciado', 'Viúvo'],
  condicionamento: ['Ótimo', 'Bom', 'Razoável', 'Ruim'],
  simNao: ['Sim', 'Não'],
} as const;

export const DadosFichaSchema = z.object({
  nomeCompleto: z.string().nullable(),
  nascimento: z.string().nullable(),
  cpf: z.string().nullable(),
  rg: z.string().nullable(),
  passaporte: z.string().nullable(),
  vencimentoPassaporte: z.string().nullable(),
  nacionalidade: z.string().nullable(),
  cep: z.string().nullable(),
  endereco: z.string().nullable(),
  numeroComplemento: z.string().nullable(),
  bairro: z.string().nullable(),
  cidade: z.string().nullable(),
  estado: z.string().nullable(),
  pais: z.string().nullable(),
  celular: z.string().nullable(),
  email: z.string().nullable(),
  profissao: z.string().nullable(),
  estadoCivil: z.enum(OPCOES.estadoCivil).nullable(),
  contatoEmergencia: z.string().nullable(),
  telefoneEmergencia: z.string().nullable(),
  medicamentoRegular: z.string().nullable(),
  alergias: z.string().nullable(),
  tipoSanguineo: z.string().nullable(),
  convenioMedico: z.string().nullable(),
  antecedentesClinicos: z.string().nullable(),
  condicionamentoFisico: z.enum(OPCOES.condicionamento).nullable(),
  sabeNadar: z.enum(OPCOES.simNao).nullable(),
  diabetico: z.enum(OPCOES.simNao).nullable(),
  disturbioCardioRespiratorio: z.enum(OPCOES.simNao).nullable(),
  restricoesAlimentares: z.enum(OPCOES.simNao).nullable(),
  descricaoRestricoes: z.string().nullable(),
  vacinaTetano: z.boolean(),
  vacinaFebreAmarela: z.boolean(),
  vacinaCovid: z.boolean(),
  outrasObservacoes: z.string().nullable(),
});
export type DadosFicha = z.infer<typeof DadosFichaSchema>;
```

## 4. Mapeamento → Ficha (`lib/ficha/mapping.ts`)

Entrada: `dados_rd.campos` (chaves do [catálogo](colunas-rd.md), já normalizadas; duplicatas do RD como `Estado`/`Estado:` já combinadas). "→ cliente" = sem fonte no CSV, fica em branco.

| Campo ficha | Chave(s) em `dados_rd.campos` | Regra |
|---|---|---|
| nomeCompleto | `nome` | — |
| nascimento | `nascimento` | — |
| cpf | `cpf` | — |
| rg | `rg` | — |
| passaporte | `passaporte` | — |
| vencimentoPassaporte | `passaporteExpiracao` | **não** usar `passaporteEstrangeiroExpiracao` |
| nacionalidade | `nacionalidade` | — |
| cep | `cep` | — |
| endereco | `endereco` | — |
| numeroComplemento | `numero` + `complemento` | `juntar(' / ', …)` |
| bairro | `bairro` | — |
| cidade | `cidade` | — |
| estado | `estado` | — |
| pais | `pais` | se vazio e `semAcento(nacionalidade)` começa com `brasileir` → `Brasil` |
| celular | `telefone` | — |
| email | `email` | — |
| profissao | `cargo` | — |
| estadoCivil | — | → cliente |
| contatoEmergencia | `emergenciaNome` + `emergenciaParentesco` | `"Nome (Parentesco)"`; sem parentesco → só o nome |
| telefoneEmergencia | `emergenciaTelefone` | — |
| medicamentoRegular | `usaMedicamento` + `medicamentosDescricao` | descrição, se houver; senão `usaMedicamento` (`"Sim"`/`"Não"`); senão `null` |
| alergias | `temAlergia` + `alergiasDescricao` + `alergiaAlimentarDescricao` (prefixo `"Alimentar: "`) | descrições com `juntar(' — ', …)`; se nenhuma → `temAlergia` (`"Sim"`/`"Não"`); senão `null` |
| tipoSanguineo | `tipoSanguineo` | maiúsculas, sem espaços (`o +` → `O+`) |
| convenioMedico | — | → cliente |
| antecedentesClinicos | `doencaCronicaDescricao`, `cirurgiaDescricao` (prefixo `"Cirurgia: "`), `questaoMedicaDescricao` + `temDoencaCronica`, `fezCirurgia`, `temQuestaoMedica` | descrições com `juntar(' — ', …)`; se nenhuma e **as três** perguntas = `Não` → `"Não"`; senão `null` |
| condicionamentoFisico | — | → cliente (não inferir de `praticaAtividadeFisica`) |
| sabeNadar | `sabeNadar` | — |
| diabetico | — | → cliente |
| disturbioCardioRespiratorio | — | → cliente |
| restricoesAlimentares | `segueDieta` + descrições abaixo | `'Sim'` se `segueDieta = Sim` **ou** houver descrição; `'Não'` se `segueDieta = Não` e sem descrição; senão `null` |
| descricaoRestricoes | `qualDieta` (prefixo `"Dieta: "`), `restricoesAlimentaresDescricao`, `alimentosNaoCome` | `juntar(' — ', …)` |
| vacinaTetano | `vacinas` | algum item, com `semAcento`, casa com `/tetan\|\bdtp?a?\b/` (pega `tétano`, `antitetânica`, `dT`, `dTpa`) |
| vacinaFebreAmarela | `vacinas` | algum item contém `febre amarela` |
| vacinaCovid | `vacinas`, `temCertificadoCovid` | algum item contém `covid` **ou** certificado = Sim |
| outrasObservacoes | `comentarios`, `restricaoFisicaDescricao` (prefixo `"Mobilidade: "`), `observacaoExtra`, `apelido` (prefixo `"Prefere ser chamado(a): "`) | `juntar('\n', …)` |

- As colunas de texto livre usam o normalizador `descricao`, então respostas soltas como `"Não!"` em "Gostaria de fazer alguma observação?" já chegam como `null` e não viram observação.
- Vacina não mencionada fica desmarcada (o checkbox não tem estado "não informado"); o cliente confere no PDF.
- As demais chaves do catálogo não têm campo no template: continuam em `dados_rd.campos`, aparecem no admin e na exportação. `observacoesInternas` **nunca** vai para o PDF nem para a página do cliente.

**Casos de teste de referência** — `tests/fixtures/rd-export.csv` (98 colunas, cabeçalho idêntico ao export real, dados **fictícios**):
- **Completo** (`ID …a03`, Antônio Ribeiro Neto): nascimento `18/03/1945`; CPF `123.456.789-09`; passaporte `GB123456` (veio minúsculo); vencimento `09/02/2030`; numeroComplemento `100 / Casa 3 Cond Colina Verde` (espaço duplo colapsado); pais `Brasil`; celular `(16) 98000-1111` (veio `(16) 9 8000-1111`); telefoneEmergencia `(16) 99000-1111`; contatoEmergencia `Maria Aparecida Souza (Secretaria)`; tipoSanguineo `O+` (veio `o +`); medicamentoRegular `Não`; alergias `Não`; antecedentesClinicos `Não` (descrições `n/a` + três respostas `nao`); sabeNadar `Sim`; restricoesAlimentares `Sim` com a descrição de `alimentosNaoCome`; vacinas febre amarela ✔ covid ✔ tétano ✘; outrasObservacoes = `Mobilidade: dificuldade em longas caminhadas\nPrefere ser chamado(a): Antônio`. Em `dados_rd.campos`: `altura = 1.65`, `vacinas = ['Febre amarela', 'Covid-19']`, `idiomas = ['Ingles', 'Espanhol']`, `rdEmpresaId` preenchido.
- **Parcial** (`…a01`, Carlos Alberto Pereira): nascimento `1960-02-19` → `19/02/1960`; celular `(19) 99888-1234` (telefone com `;` usa o primeiro); email em minúsculas; pais `Brasil` (vazio + nacionalidade `Brasileiro`); numeroComplemento `220 / Torre 3 apto. 223`; outrasObservacoes = só `Prefere ser chamado(a): Carlão` (o `"Não!"` de `observacaoExtra` é descartado); `aeroportoOrigem`, `levaAcompanhante = 'Não'`, `distribuidora` e `tipoInscricao` presentes em `dados_rd.campos`.
- **Vazios** (`…a02` e `…a04`): ficha gerada só com nome, e-mail e celular, sem erro.
- **Coluna nova:** acrescentar uma coluna fora do catálogo à fixture num teste → vai para `dados_rd.extras` e gera aviso.

## 5. Campos do PDF modelo (`lib/ficha/pdf/fields.ts`)

Template: `assets/templates/ficha-cadastro-2024.pdf` (A4, 1 página, Scribus, `NeedAppearances = true`). Os nomes internos são genéricos — **usar exatamente estes nomes**:

```ts
export const CAMPOS_PDF = {
  nomeCompleto:                'Copiar de Campo de texto20 (2)',
  nascimento:                  'Copiar de Campo de texto20 (17)',
  cpf:                         'Campo de texto20',
  rg:                          'Copiar de Campo de texto20 (14)',
  passaporte:                  'Copiar de Campo de texto20',
  vencimentoPassaporte:        'Copiar de Campo de texto20 (13)',
  nacionalidade:               'Copiar de Campo de texto20 (25)',
  cep:                         'Copiar de Campo de texto20 (3)',
  endereco:                    'Copiar de Campo de texto20 (4)',
  numeroComplemento:           'Copiar de Campo de texto20 (5)',
  bairro:                      'Copiar de Campo de texto20 (6)',
  cidade:                      'Copiar de Campo de texto20 (7)',
  estado:                      'Copiar de Campo de texto20 (8)',
  pais:                        'Copiar de Campo de texto20 (9)',
  celular:                     'Copiar de Campo de texto20 (10)',
  email:                       'Copiar de Campo de texto20 (11)',
  profissao:                   'Copiar de Campo de texto20 (15)',
  estadoCivil:                 'Lista suspensa58',                  // dropdown
  contatoEmergencia:           'Copiar de Campo de texto20 (16)',
  telefoneEmergencia:          'Copiar de Campo de texto20 (18)',
  medicamentoRegular:          'Copiar de Campo de texto20 (19)',   // multilinha
  alergias:                    'Copiar de Campo de texto20 (20)',   // multilinha
  tipoSanguineo:               'Copiar de Campo de texto20 (21)',
  convenioMedico:              'Copiar de Campo de texto20 (22)',   // multilinha
  antecedentesClinicos:        'Copiar de Campo de texto20 (23)',   // multilinha
  condicionamentoFisico:       'Copiar de Lista suspensa58',        // dropdown
  sabeNadar:                   'Copiar de Lista suspensa58 (2)',    // dropdown
  diabetico:                   'Copiar de Lista suspensa58 (3)',    // dropdown
  disturbioCardioRespiratorio: 'Copiar de Lista suspensa58 (4)',    // dropdown
  restricoesAlimentares:       'Copiar de Lista suspensa58 (5)',    // dropdown
  descricaoRestricoes:         'Copiar de Campo de texto20 (24)',   // multilinha
  vacinaTetano:                'Caixa de seleção101',               // checkbox (/Yes)
  vacinaFebreAmarela:          'Copiar de Caixa de seleção101',     // checkbox (/Yes)
  vacinaCovid:                 'Copiar de Caixa de seleção101 (2)', // checkbox (/Yes)
  outrasObservacoes:           'Copiar de Campo de texto20 (26)',   // multilinha
} as const satisfies Record<keyof DadosFicha, string>;

export const PLACEHOLDER_DROPDOWN = '---Selecione---';
```

Opções dos dropdowns (a primeira é o placeholder `---Selecione---`, que representa `null`):
- `Lista suspensa58`: Solteiro, Casado, Separado, Divorciado, Viúvo
- `Copiar de Lista suspensa58`: Ótimo, Bom, Razoável, Ruim
- `(2)`, `(3)`, `(4)`, `(5)`: Sim, Não

Fonte padrão dos campos: 10 pt (texto) e 12 pt (dropdown). Não existe campo "nome da viagem".

**Layout do modelo (referência visual aprovada pela equipe).** O PDF entregue ao cliente **é o próprio template preenchido**. Nunca redesenhar, reposicionar ou gerar a página do zero; o pdf-lib só escreve valores nos campos que já existem.
- Cabeçalho: logo Latitudes à esquerda, título "FICHA DE CADASTRO" em laranja, texto de instruções e, em laranja itálico, "Por favor, não preencher à mão."
- Campos: retângulos cinza-azulados sem borda, rótulo em negrito acima. Dropdowns mostram `---Selecione---`. Vacinas são 3 checkboxes na mesma linha, com a dica laranja "(marque o checkbox)".
- Todos os campos têm **18 pt de altura** (uma linha visível), exceto "Outras observações" (45 pt). Os marcados `// multilinha` têm a flag multiline ligada, mas continuam com uma linha visível. Larguras vão de 74 pt (tipo sanguíneo) a 422 pt (nome).
- Consequência: textos longos do RD (medicamentos, alergias, antecedentes, restrições) não cabem. Usar o `ajustarFonte` até o mínimo e **nunca cortar o valor**: o texto completo fica no campo (o leitor rola) e sempre está completo no banco e na tela de revisão do admin.
- O template tem um erro de digitação que não vem de nós: "Descrição das **restições** alimentares". Só dá para corrigir editando o template no Scribus.

**Inspeção do template (24/09/2026):**
- 35 campos, nomes idênticos a `CAMPOS_PDF`. `NeedAppearances = true`. Criado no Scribus 1.6.1 e já salvo uma vez pelo pdf-lib.
- Cores dos campos: fundo `MK /BG` = `#CFD6DA` (0.81176 0.83922 0.8549), texto `#171715`. Fonte `/Fo3Form` 10 pt (texto) e `/Fo0Form` 12 pt (dropdown). Checkbox com estilo `/CA (4)` (✓) e valor ligado `/Yes`.
- **JavaScript existente (só este):** `/AA` nos campos `Copiar de Campo de texto20 (17)` (nascimento) e `Copiar de Campo de texto20 (13)` (vencimento do passaporte), com `/K` = `AFDate_KeystrokeEx("dd/mm/yyyy")` e `/F` = `AFDate_FormatEx("dd/mm/yyyy")`. É o formatador de data do Acrobat: as datas **precisam** ir no formato `DD/MM/AAAA` (o normalizador `data` já garante isso).
- Sem `/OpenAction`, sem `/Names` e sem `/AA` no catálogo.

## 6. Preencher o PDF (`lib/ficha/pdf/fill.ts`)

```ts
import { PDFDocument, PDFTextField, PDFDropdown, PDFCheckBox, StandardFonts } from 'pdf-lib';
import { CAMPOS_PDF, PLACEHOLDER_DROPDOWN } from './fields';
import { paraWinAnsi } from './winansi';

export async function preencherFicha(template: Uint8Array, d: DadosFicha) {
  const pdf = await PDFDocument.load(template);
  const form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica); // WinAnsi: cobre acentos PT-BR, não cobre emoji

  for (const [chave, nome] of Object.entries(CAMPOS_PDF)) {
    const valor = d[chave as keyof DadosFicha];
    const campo = form.getField(nome);
    if (campo instanceof PDFTextField) {
      const txt = paraWinAnsi(font, (valor as string | null) ?? '', campo.isMultiline());
      campo.setText(txt);
      ajustarFonte(campo, txt, font);           // reduz até 6 pt se não couber
    } else if (campo instanceof PDFDropdown) {
      if (valor) campo.select(valor as string); // valor precisa existir nas opções
      else if (campo.getOptions().includes(PLACEHOLDER_DROPDOWN)) campo.select(PLACEHOLDER_DROPDOWN);
      else campo.clear();
    } else if (campo instanceof PDFCheckBox) {
      if (valor) campo.check(); else campo.uncheck();
    }
  }
  form.updateFieldAppearances(font);
  // NUNCA: form.flatten()
  return pdf.save();
}
```

- **`paraWinAnsi(font, txt, multilinha)`** (`lib/ficha/pdf/winansi.ts`): a Helvetica padrão só codifica WinAnsi, e o pdf-lib **lança erro** com emoji, `→`, letras de outros alfabetos etc. Para cada caractere fora de `font.getCharacterSet()`: tentar a versão sem acento (NFD sem marcas); se ainda não couber, remover. Em campo de uma linha, trocar `\n` por `' — '`. Registrar aviso quando algo for removido. Aplicar a **todo** texto que vai para o PDF.
- `select()` lança erro se o valor não estiver nas opções → validar com zod antes; valor fora da lista vai para `outrasObservacoes` com aviso.
- `ajustarFonte`: para campos de uma linha, `font.widthOfTextAtSize(txt, size)` ≤ largura do widget − 4; para multilinha, estimar linhas. Tamanho mínimo 6 pt; se ainda não couber, manter o texto (o leitor rola o campo) e registrar aviso.
- Metadados: `pdf.setTitle('Ficha de Cadastro — <Nome>')`, `setProducer('LatForms — Latitudes')`.
- Nome do arquivo: `Ficha_Cadastro_<Nome_Sobrenome_sem_acento>_<AAAA-MM-DD>.pdf` (data em `America/Sao_Paulo`).
- **Implementado (Fase 4):** `lib/ficha/pdf/{fields,winansi,fill,read,template}.ts`. `paraWinAnsi` também translitera letras que o NFD não decompõe (Ł→L, đ→d, ı→i, →→->). `template.ts` usa caminho **literal** (`path.join(process.cwd(), 'assets', 'templates', '…pdf')`): com variável, o Turbopack inclui o projeto inteiro no deploy. `next.config.ts` inclui `assets/templates/**` em `/api/**/*` via `outputFileTracingIncludes`.
- **Geração sob demanda:** `GET /api/f/[token]/pdf` e `GET /api/fichas/[id]/pdf?tipo=gerado` leem o template de `assets/templates/` (cachear o `Uint8Array` em variável de módulo), preenchem com `fichas.dados_snapshot` e respondem com `Content-Disposition: attachment`. Nada é salvo no Storage. `export const runtime = 'nodejs'`.

## 7. Receber e ler o PDF devolvido (`lib/ficha/pdf/read.ts`)

Fluxo de upload (sem passar o arquivo pela Vercel):
1. No browser, checar `file.type === 'application/pdf'` e `file.size ≤ 5 MB` para feedback rápido (a validação real é no passo 4).
2. `POST /api/f/[token]/upload-url` → valida token + rate limit + status permite upload (§8) → `storage.from('fichas-respondidas').createSignedUploadUrl('<ficha_id>/<timestamp>.pdf')` → retorna `{ path, token }`. A URL vale **2 h (fixo no Supabase, não configurável)**; a proteção vem do caminho novo e único, sem `upsert`, e da validação do passo 4.
3. Browser do cliente: `uploadToSignedUrl(path, token, file)` direto no Supabase (cliente Supabase com a publishable key).
4. `POST /api/f/[token]/confirmar { path }` → confere que `path` começa com `<ficha_id>/` (senão 403), checa o tamanho pelos metadados do objeto antes de baixar, baixa e valida (abaixo). Se inválido, **apaga** o arquivo e retorna 422.

Validação no servidor:
- ≤ 5 MB, começa com `%PDF-`, abre com `PDFDocument.load` sem `ignoreEncryption`.
- **Validar que é o template**: o conjunto de nomes de campos do arquivo deve conter todos os valores de `CAMPOS_PDF`. Senão → 422 "Envie o arquivo da ficha que você baixou. Se você editou no Preview do Mac ou no navegador e o erro continuar, use o Adobe Reader."
- **JavaScript:** procurar `/JS` e `/JavaScript` no catálogo, em `/Names`, `/OpenAction` e nos `/AA` de páginas e widgets. Lista permitida = exatamente o JS do template (§5): `AFDate_KeystrokeEx("dd/mm/yyyy")` e `AFDate_FormatEx("dd/mm/yyyy")` nos `/AA` dos campos de nascimento e vencimento. Qualquer outro código → 422.
- Converter de volta: texto → string trim (vazio = null); dropdown `---Selecione---` → null; checkbox `isChecked()`.
- Validar com `DadosFichaSchema`, salvar em `fichas.dados_respondidos` e `fichas.pdf_respondido_path`; status → `respondida`. Um novo envio antes da aprovação substitui o anterior (apagar o arquivo antigo para economizar Storage).

## 8. Tokens e status (`lib/tokens.ts`, `lib/ficha/status.ts`)

```ts
import { randomBytes, createHash } from 'node:crypto';
export const gerarToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
```

- Validade: `TOKEN_TTL_DIAS` (padrão 15). Criar novo link **revoga** o anterior, na função SQL `gerar_link` (transação; índice único garante 1 token ativo por ficha).
- Validação: busca por `token_hash`, checa `revogado_em is null`, `expira_em > now()` e ficha ≠ `cancelada`; incrementa `usos` e `ultimo_acesso_em`.
- URL: `${APP_URL}/f/${token}`. Não colocar o token em query string.
- **Abrir a página `/f/[token]` não muda o status.** Pré-visualizações de link e antivírus de e-mail também abrem a URL. O status só vira `aberta` quando o PDF é baixado (`GET /api/f/[token]/pdf`) e a ficha está em `enviada`.

Transições (centralizar em `lib/ficha/status.ts`; qualquer outra → erro):

| De | Evento | Para |
|---|---|---|
| — | criar ficha | `gerada` |
| `gerada` | gerar link | `enviada` |
| `enviada`, `aberta`, `respondida`, `correcao_solicitada` | gerar novo link | mantém o status |
| `enviada` | cliente baixa o PDF | `aberta` |
| `enviada`, `aberta`, `respondida`, `correcao_solicitada` | upload válido | `respondida` |
| `respondida` | funcionário pede correção (`motivo_correcao`, curto e sem dados sensíveis) | `correcao_solicitada` |
| `respondida` | funcionário aprova | `aprovada` |
| qualquer exceto `aprovada` | funcionário cancela | `cancelada` |

Em `aprovada`, o link ainda permite baixar, mas não enviar. Em `correcao_solicitada`, a página do cliente mostra o `motivo_correcao`; a equipe avisa o cliente pelo canal de sempre (não há envio automático).

## 9. Página do cliente `/f/[token]`

- Server component dinâmico; mostra apenas o **primeiro nome**; nenhum dado sensível no HTML.
- Passos em linguagem simples: 1) Baixe sua ficha; 2) Abra no computador (Adobe Reader recomendado), confira e complete; 3) Salve; 4) Envie aqui.
- Aviso do modelo: "Por favor, não preencher à mão."
- Upload com feedback de sucesso/erro; após envio, mensagem de confirmação.
- Rate limit: chave `f:<ip>`, com o IP de `x-real-ip` (header da Vercel), 20 req/min.
- Cabeçalhos: `Referrer-Policy`, `X-Robots-Tag` e `X-Frame-Options` vêm do `next.config.ts`. **`Cache-Control: no-store` precisa ser definido na própria resposta** (route handlers de `/api/f/*`; página com `export const dynamic = 'force-dynamic'`): o Next sobrescreve o `Cache-Control` do `next.config` em páginas. Testar com `next build && next start`, não só no dev.
- Visual seguindo a ficha em PDF: fundo branco, logo Latitudes no topo, títulos em laranja (`#E8912D`, aproximado), texto cinza-escuro, blocos e botões secundários no cinza-azulado dos campos (`#CFD6DA`, exato do template), texto `#171715`. Tipografia sem serifa, rótulos em negrito, avisos importantes em laranja itálico, como no modelo. Responsivo (o cliente pode abrir no celular, mas o passo de preencher recomenda computador).

## 10. Área dos funcionários

- `proxy.ts`: renova a sessão Supabase e redireciona para `/login` quem não está logado em `/admin/*`. O `matcher` **exclui** `/f/*`, `/api/f/*`, `/api/cron/*`, `/login` e arquivos estáticos. Não consulta o banco.
- `exigirFuncionario()` (`lib/auth.ts`): lê a sessão no servidor (`supabase.auth.getUser()`), confere o registro em `funcionarios`, retorna 401/403. Chamada no `app/admin/layout.tsx` **e** em cada página que busca dados, cada server action e cada route handler de funcionário (layout e página renderizam em paralelo no Next 16; o layout não protege os dados da página). Implementação: `verificarFuncionario()` para páginas/actions, `exigirFuncionario()` para route handlers (devolve `Response` 401/403).
- Signup público desativado; novos funcionários são criados manualmente no painel do Supabase (Auth → Add user) e inseridos em `funcionarios`. Não depender do envio de e-mails do Supabase.
- Importação (`app/admin/importar`, lógica pura em `lib/importacao/lote.ts`): o navegador lê o CSV e envia lotes de 200 para `POST /api/importacoes/previa` (não grava) e monta a prévia → ao confirmar, `POST /api/importacoes` cria o registro e os lotes vão para `POST /api/importacoes/[id]/lote` (upsert por `rd_id`, atualiza contadores e `erros` só com índice/ID/mensagem). ID repetido no arquivo: vale a última ocorrência. Mostrar por linha: novo/atualizado, avisos (data inválida, CPF inválido, telefone ausente, caractere removido) e erros (sem ID).
- A prévia também lista, para o arquivo inteiro: colunas novas fora do catálogo (vão para `extras`) e colunas do catálogo ausentes no CSV.
- Tela do cliente (`/admin/clientes/[id]`): mostra **todos** os campos de `dados_rd.campos`, agrupados por `grupo` do [catálogo](colunas-rd.md), com vazios recolhidos, mais o bloco "Outras colunas do RD" (`extras`). Campos 🔒 e `observacoesInternas` ficam só nessa área interna.
- Exportação (`/api/exportar`): uma coluna por chave do catálogo + `extras` + `dados_respondidos`; grava na `auditoria`.
- Reimportação faz upsert por `rd_id` e **não** apaga fichas já geradas; mostrar aviso se `dados_ficha` mudou desde a última geração.

## 11. Testes obrigatórios

- Unit: parser (BOM + linha `sep=`, cabeçalhos com espaço, cabeçalhos que colidem, linhas vazias, windows-1252), cada normalizador, cada linha da tabela de mapeamento, os casos de referência da seção 4 (todas as 98 colunas da fixture extraídas, com o tipo certo), coluna nova → `extras`, nome vazio.
- PDF: gerar → ler de volta → `dados` iguais (round-trip); checkbox e dropdown preservados (inclusive `null` → placeholder); acentos (`Não`, `Ribeirão`, `Viúvo`); texto com emoji não quebra a geração.
- PDF real: fixture preenchida e salva no Adobe Reader (`tests/fixtures/ficha-preenchida-reader.pdf`) é lida por completo.
- Tokens: expirado, revogado, inexistente, ficha cancelada → 404; válido → 200; abrir a página não muda status, baixar o PDF muda para `aberta`.
- Status: todas as transições da tabela da §8; transição inválida → erro.
- Auth: route handler de funcionário chamado direto sem sessão → 401; com sessão mas fora de `funcionarios` → 403.
- Rate limit: `consumir_rate_limit` chamada com a publishable key → negada.
- Upload: `confirmar` com path de outra ficha → 403; arquivo que não é o template → 422 e arquivo apagado; PDF com JavaScript → 422; upload em ficha `aprovada` → recusado.
- Cron: sem `CRON_SECRET` → 401 (e não redireciona para `/login`); com secret → executa limpeza e grava em `auditoria`.
- E2E (Playwright): login → importar CSV de fixture → gerar ficha → gerar link → abrir link anônimo → baixar → enviar PDF preenchido → ver status `respondida` no admin → pedir correção → reenviar → aprovar.
- Fixtures com dados **anonimizados** (não commitar dados reais de clientes).
- CI no GitHub Actions (`ci.yml`): `npm run check` a cada push. E2E roda local contra `latforms-dev` (economiza minutos do Actions).

## 12. Operação no plano gratuito

`vercel.json`:
```json
{
  "regions": ["gru1"],
  "crons": [{ "path": "/api/cron/manutencao", "schedule": "0 9 * * *" }]
}
```
(9h UTC = 6h em Brasília. A Vercel envia `Authorization: Bearer ${CRON_SECRET}` automaticamente quando a variável existe.)

`/api/cron/manutencao` (idempotente): `select 1` no banco (keep-alive) → apaga linhas de `rate_limit` com mais de 1 dia → apaga tokens expirados há mais de 30 dias → remove do Storage PDFs de fichas `aprovada` há mais de 90 dias (zera `pdf_respondido_path`) → remove do Storage uploads com mais de 1 dia que não são o `pdf_respondido_path` de nenhuma ficha → anonimiza `ip`/`user_agent` da `auditoria` com mais de 180 dias → registra em `auditoria`.

`.github/workflows/backup.yml` (diário):
- Instalar o `postgresql-client` **da mesma versão major do servidor** pelo repositório PGDG (`apt.postgresql.org`); o cliente padrão do `ubuntu-latest` pode ser mais antigo e o `pg_dump` recusa ("server version mismatch"). Conferir a versão com `select version()` no painel.
- Dois dumps com a connection string do **pooler em modo session** (o runner não tem IPv6):
  - `pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges -Fc --schema=public -f public.dump`
  - `pg_dump "$SUPABASE_DB_URL" --data-only -Fc --table=auth.users --table=auth.identities -f auth.dump`
  Não fazer dump do banco inteiro: os schemas gerenciados pelo Supabase (`auth`, `storage`, `realtime`…) dão conflito na restauração.
- Juntar os dois num `.tar`, criptografar com `gpg --batch --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE"` e publicar com `actions/upload-artifact` (`retention-days: 30`). Nunca publicar o dump sem criptografia.
- Secrets: `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`.
- Restauração (documentar no README): projeto novo → `supabase db push` (migrations) → `pg_restore --data-only` do `auth.dump` → `pg_restore --data-only` do `public.dump`. Os PDFs do Storage **não** entram no backup.
