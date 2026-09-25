---
name: ficha-cadastro-latitudes
description: Regras de domínio do LatForms, o motor de fichas da Latitudes — parse do CSV exportado do RD Station, normalizadores, definição dos 71 campos da ficha (lib/ficha/campos.ts) e mapeamento 1:1, geração do PDF editável com pdf-lib no visual Latitudes, leitura do PDF devolvido, upload do cliente, tokens por URL, ciclo de status da ficha, área dos funcionários, cron e backup. Use ao mexer em importação de CSV, mapeamento de campos, geração ou leitura do PDF, tokens, rotas /f/[token], status da ficha, cron ou backup.
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

## 3. Definição da ficha (`lib/ficha/campos.ts`) — fonte única

**Modelo v2 (25/09/2026), gerado pelo sistema.** O modelo Scribus de 2024 (35 campos) foi aposentado e está só como referência em `docs/modelo-2024/`. A ficha tem **71 campos**: os **66 do formulário do RD** (lista aprovada pela equipe, na ordem do formulário) + **5 do modelo de 2024** que só o cliente preenche (`estadoCivil`, `convenioMedico`, `condicionamentoFisico`, `diabetico`, `disturbioCardioRespiratorio`).

- `CAMPOS_FICHA`: `{ chave, rotulo, tipo, origem, opcoes?, emLinha?, colunas }`. `chave` = nome do campo no PDF = chave em `DadosFicha` = **mesma chave do RD** quando há `origem`. Tipos: `texto`, `multilinha`, `simNao` (lista Sim/Não), `opcoes` (lista fixa).
- `SECOES_FICHA`: seções e linhas (grade de 12 colunas). Toda chave aparece exatamente uma vez (testado).
- **Colunas do CSV que NÃO entram no PDF** (decisão da equipe): tudo que não está na lista — ex.: `qualDieta`, `cargo`, `genero`, `empresa`, `aeroportoOrigem`, `levaAcompanhante`, `acompanhantes`, `tipoInscricao`, `distribuidora`, `observacaoExtra`, passaporte estrangeiro (número/datas/país), `enderecoEntrega`, dados de RD/marketing e **`observacoesInternas` (nunca)**. Continuam em `dados_rd` e visíveis só para a equipe.
- Para acrescentar/remover campo da ficha: editar `CAMPOS_FICHA` + `SECOES_FICHA` (o PDF, a leitura e a tela do admin acompanham). Fichas já geradas guardam o snapshot antigo.

`DadosFicha = Record<ChaveFicha, string | null>` (`lib/ficha/schema.ts`); `DadosFichaSchema` é gerado de `CAMPOS_FICHA` (`.strict()`; sim/não e opções validados como enum).

## 4. Mapeamento → Ficha (`lib/ficha/mapping.ts`)

Entrada: `dados_rd.campos`. **1:1**: cada campo com `origem` recebe o valor da coluna do RD de mesma chave; listas viram `"a, b"`, números viram texto pt-BR (`1.65` → `"1,65"`). Sim/não e opções só entram se o valor for exatamente uma opção válida (senão `null`). Campos sem origem ficam `null` (cliente preenche). **Nada de saúde é inferido.**

Ajustes de apresentação (não inventam dado): `tipoSanguineo` maiúsculo sem espaços (`o +` → `O+`); `pais` vazio + nacionalidade `brasileir*` → `Brasil`.

O snapshot da ficha (`POST /api/fichas`) e a tela do admin **sempre** mapeiam de `dados_rd.campos` (modelo atual); a coluna `clientes.dados_ficha` é só um cache preenchido na importação.

**Casos de teste de referência** — `tests/fixtures/rd-export.csv` (98 colunas, cabeçalho idêntico ao export real, dados **fictícios**):
- **Completo** (`…a03`, Antônio Ribeiro Neto): 56 campos preenchidos vindos do RD (ver `tests/unit/mapping.test.ts`), p.ex. nascimento `18/03/1945`, CPF `123.456.789-09`, passaporte `GB123456`, expiração `09/02/2030`, telefone `(16) 98000-1111`, médico `Dr. Fulano de Tal`, altura `1,65`, vacinas `Febre amarela, Covid-19`, `temRestricaoFisica = Sim` + descrição `dificuldade em longas caminhadas`, `doencaCronicaDescricao = null` (veio `n/a`). Os 5 campos do modelo de 2024 ficam `null`.
- **Parcial** (`…a01`): nascimento ISO → `19/02/1960`, primeiro telefone do `;`, país `Brasil` pela nacionalidade, `numero = 220`, `complemento = Torre 3 apto. 223`, apelido `Carlão`.
- **Vazios** (`…a02`, `…a04`): só `nome`, `email` e `telefone`.

## 5. Geração do PDF (`lib/ficha/pdf/gerar.ts`)

`gerarFicha(dados, recursos)` desenha a ficha inteira com pdf-lib (A4, ~4 páginas) e cria os 71 campos **editáveis já preenchidos**. **Nunca `form.flatten()`.**

- **Visual (medido no modelo de 2024):** logo Latitudes (`assets/templates/logo-latitudes.png`, extraído do modelo) no canto, título "FICHA DE CADASTRO" Open Sans Bold 13 laranja `#DA8E1E`, texto de instruções Open Sans 10,5 `#181715` terminando em laranja itálico "Por favor, não preencher à mão.", títulos de seção em laranja, rótulos Open Sans Bold 8,5 `#5C4E43`, campos com fundo `#CFD6DA` sem borda, "Página X de Y" no rodapé. Páginas seguintes: logo pequeno + título à direita.
- **Fontes:** Open Sans (OFL, `assets/fonts/` + `OFL.txt`) para o texto fixo, via `@pdf-lib/fontkit` com subset. **Os campos usam Helvetica** (padrão dos leitores, edição confiável) → todo valor passa por `paraWinAnsi` (tira/translitera emoji e letras fora do WinAnsi; Ł→L, đ→d, →→->) e gera aviso sem conteúdo.
- **Layout:** grade de 12 colunas; `simNao` (e `emLinha`) = pergunta à esquerda e lista à direita; demais = rótulo acima do campo; `multilinha` = 36 pt de altura. Quebra de página automática; título de seção nunca fica sozinho no pé; pergunta sim/não nunca se separa da descrição logo abaixo.
- **Textos longos:** fonte do campo reduz de 10 até 6,5 pt; se nem assim couber, o valor fica inteiro (o leitor rola) e sai aviso. Nunca cortar.
- **Sem JavaScript** no PDF gerado (o modelo de 2024 tinha formatador de data do Acrobat; o v2 não tem).
- Metadados: título `Ficha de Cadastro — <Nome>`, assunto `MODELO_FICHA` (`LatForms — Ficha de Cadastro v2`), autor Latitudes.
- Nome do arquivo: `nomeArquivoFicha()` → `Ficha_Cadastro_<Nome_Sobrenome_sem_acento>_<AAAA-MM-DD>.pdf` (data em `America/Sao_Paulo`).

## 6. Servir o PDF

- `lib/ficha/pdf/recursos.ts` lê fontes e logo do disco uma vez por instância, com **caminhos literais** (`path.join(process.cwd(), 'assets', 'fonts', '…')`): com variável, o Turbopack inclui o projeto inteiro no deploy. `next.config.ts` inclui `assets/fonts/**` e `assets/templates/**` em `/api/**/*` (`outputFileTracingIncludes`). Conferir o `.nft.json` da rota depois de mudar.
- `GET /api/fichas/[id]/pdf?tipo=gerado` (e depois `GET /api/f/[token]/pdf`): gera a partir de `fichas.dados_snapshot` e responde com `Content-Disposition: attachment` e `Cache-Control: private, no-store`. Nada é salvo no Storage. Snapshot fora do schema atual (ficha do modelo antigo) → 422 "gere uma nova versão".
- Geração leva ~0,3–0,7 s.

## 7. Receber e ler o PDF devolvido (`lib/ficha/pdf/read.ts`)

Fluxo de upload (sem passar o arquivo pela Vercel):
1. No browser, checar `file.type === 'application/pdf'` e `file.size ≤ 5 MB` para feedback rápido (a validação real é no passo 4).
2. `POST /api/f/[token]/upload-url` → valida token + rate limit + status permite upload (§8) → `storage.from('fichas-respondidas').createSignedUploadUrl('<ficha_id>/<timestamp>.pdf')` → retorna `{ path, token }`. A URL vale **2 h (fixo no Supabase, não configurável)**; a proteção vem do caminho novo e único, sem `upsert`, e da validação do passo 4.
3. Browser do cliente: `uploadToSignedUrl(path, token, file)` direto no Supabase (cliente Supabase com a publishable key).
4. `POST /api/f/[token]/confirmar { path }` → confere que `path` começa com `<ficha_id>/` (senão 403), checa o tamanho pelos metadados do objeto antes de baixar, baixa e valida (abaixo). Se inválido, **apaga** o arquivo e retorna 422.

Validação no servidor:
- ≤ 5 MB, começa com `%PDF-`, abre com `PDFDocument.load` sem `ignoreEncryption`.
- **Validar que é a nossa ficha**: o PDF deve ter todos os campos de `CAMPOS_FICHA` com o tipo certo (`lerFicha` → `nao_e_template`). O modelo antigo de 2024 é recusado. Senão → 422 "Envie o arquivo da ficha que você baixou. Se você editou no Preview do Mac ou no navegador e o erro continuar, use o Adobe Reader."
- **JavaScript:** procurar `/JS` e `/JavaScript` no catálogo, em `/Names`, `/OpenAction` e nos `/AA` de páginas e widgets. O PDF gerado (v2) **não tem nenhum JavaScript** → qualquer ocorrência → 422.
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

**Uma ficha por cliente — nunca duplica (decisão da equipe, 25/09/2026).** Índice único `fichas_uma_ativa_por_cliente` (cliente_id, onde status ≠ `cancelada`).
- Enquanto a ficha **não foi devolvida** (`gerada`, `enviada`, `aberta` → `aceitaDadosDoRd()`), ela acompanha o RD: cada importação e o botão "Atualizar ficha com o RD" trocam o `dados_snapshot` da **mesma** ficha (`versao + 1`, `snapshot_atualizado_em`), via `lib/ficha/atualizar.ts`. Status e link continuam os mesmos; o cliente passa a baixar o PDF atualizado.
- Depois de **devolvida** (`respondida`, `correcao_solicitada`, `aprovada`), vale a versão do cliente (`dados_respondidos`): importações não alteram a ficha e `POST /api/fichas` responde 409. A página do cliente mostra "Versão do cliente" e, abaixo, "Versão atual do RD Station" com os campos diferentes destacados.
- O cliente (tabela `clientes`) é sempre atualizado pelo `rd_id` na importação.

Transições (centralizar em `lib/ficha/status.ts`; qualquer outra → erro):

| De | Evento | Para |
|---|---|---|
| — | gerar ficha (só se o cliente não tem ficha ativa) | `gerada` |
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
- Visual seguindo a ficha em PDF: fundo branco, logo Latitudes no topo, títulos em laranja `#DA8E1E`, rótulos `#5C4E43`, texto `#181715`, blocos no cinza-azulado dos campos `#CFD6DA` (cores exatas do modelo; logo em `public/logo-latitudes.png`). Tipografia sem serifa, rótulos em negrito, avisos importantes em laranja itálico, como no modelo. Responsivo (o cliente pode abrir no celular, mas o passo de preencher recomenda computador).

## 10. Área dos funcionários

- `proxy.ts`: renova a sessão Supabase e redireciona para `/login` quem não está logado em `/admin/*`. O `matcher` **exclui** `/f/*`, `/api/f/*`, `/api/cron/*`, `/login` e arquivos estáticos. Não consulta o banco.
- `exigirFuncionario()` (`lib/auth.ts`): lê a sessão no servidor (`supabase.auth.getUser()`), confere o registro em `funcionarios`, retorna 401/403. Chamada no `app/admin/layout.tsx` **e** em cada página que busca dados, cada server action e cada route handler de funcionário (layout e página renderizam em paralelo no Next 16; o layout não protege os dados da página). Implementação: `verificarFuncionario()` para páginas/actions, `exigirFuncionario()` para route handlers (devolve `Response` 401/403).
- Signup público desativado. **Equipe gerenciada pelo próprio app, sem e-mail** (o SMTP padrão do Supabase Free só entrega para membros do projeto): página `/admin/equipe`.
  - Convidar: `POST /api/equipe/convites {email, nome?}` → link de uso único `/convite/<token>` (7 dias), mostrado uma vez para copiar/enviar. Tabela `convites_equipe` (só a secret key acessa; `token_hash`; um pendente por e-mail/tipo).
  - `/convite/[token]` (público, noindex, no-referrer): abrir **não** consome o link; o envio (`aceitarConvite`, rate limit `convite:<ip>` 10/10 min) valida senha (`lib/equipe/senha.ts`, mesma regra do Auth), reserva o link, cria o usuário (`auth.admin.createUser`, e-mail confirmado) e grava em `funcionarios` (com `email`). Se a conta já existia no Auth, só troca a senha e dá acesso.
  - Senha esquecida: `POST /api/equipe/[id]/nova-senha` → link `nova_senha` (24 h) no mesmo `/convite/[token]`.
  - Envio: botão "Enviar pelo Outlook" = compose do Outlook na web (`linkOutlookWeb`, aba nova). Não usar `mailto:`: não abre nada sem app de e-mail padrão no Windows (removido a pedido da equipe). Texto em `lib/equipe/mensagens.ts`; a Latitudes usa Microsoft 365. Envio automático via Microsoft Graph está nas evoluções futuras (depende da TI).
  - Remover: `DELETE /api/equipe/[id]` apaga a conta (não deixa remover a si mesmo). O proxy **não** redireciona `/login` → `/admin` por sessão (JWT de conta removida ainda parece válido → loop).
  - Formulários client com fetch: usar `onSubmit` + `preventDefault`, não `<form action={fn}>` (o React 19 limpa o form e, após um erro, o envio seguinte não disparava).
- Importação (`app/admin/importar`, lógica pura em `lib/importacao/lote.ts`): o navegador lê o CSV e envia lotes de 200 para `POST /api/importacoes/previa` (não grava) e monta a prévia → ao confirmar, `POST /api/importacoes` cria o registro e os lotes vão para `POST /api/importacoes/[id]/lote` (upsert por `rd_id`, atualiza contadores e `erros` só com índice/ID/mensagem). ID repetido no arquivo: vale a última ocorrência. Mostrar por linha: novo/atualizado, avisos (data inválida, CPF inválido, telefone ausente, caractere removido) e erros (sem ID).
- A prévia também lista, para o arquivo inteiro: colunas novas fora do catálogo (vão para `extras`) e colunas do catálogo ausentes no CSV.
- Tela do cliente (`/admin/clientes/[id]`): mostra **todos** os campos de `dados_rd.campos`, agrupados por `grupo` do [catálogo](colunas-rd.md), com vazios recolhidos, mais o bloco "Outras colunas do RD" (`extras`). Campos 🔒 e `observacoesInternas` ficam só nessa área interna.
- Exportação (`/api/exportar`): uma coluna por chave do catálogo + `extras` + `dados_respondidos`; grava na `auditoria`.
- Reimportação faz upsert por `rd_id` e **não** apaga fichas já geradas; mostrar aviso se `dados_ficha` mudou desde a última geração.

## 11. Testes obrigatórios

- Unit: parser (BOM + linha `sep=`, cabeçalhos com espaço, cabeçalhos que colidem, linhas vazias, windows-1252), cada normalizador, cada linha da tabela de mapeamento, os casos de referência da seção 4 (todas as 98 colunas da fixture extraídas, com o tipo certo), coluna nova → `extras`, nome vazio.
- PDF: gerar → ler de volta → `dados` iguais (round-trip) nos 4 casos; 71 campos editáveis com o tipo certo; dropdown `null` → placeholder; acentos (`Não`, `Ribeirão`, `Viúvo`); emoji não quebra a geração; texto longo nunca é cortado; modelo de 2024 recusado na leitura. Conferir o visual renderizando o PDF (PyMuPDF num venv do scratchpad) sempre que mexer no layout.
- PDF real: fixture da ficha v2 preenchida e salva no Adobe Reader (`tests/fixtures/ficha-preenchida-reader.pdf`) é lida por completo.
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
