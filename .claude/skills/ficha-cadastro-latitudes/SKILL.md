---
name: ficha-cadastro-latitudes
description: Regras do LatForms, o motor de fichas da Latitudes — parse do CSV do RD Station, mapeamento para a Ficha de Cadastro (71 campos), ficha web editável no layout do PDF com autosave, acompanhamento em tempo real pelas consultoras (Supabase Realtime, campos editados em amarelo), links com token, PDF final, LGPD e custo zero (Vercel + Supabase Free). Use ao mexer em importação, mapeamento, componentes da ficha, autosave, realtime, tokens, rotas /f/[token], PDF, infraestrutura ou dependências.
---

# LatForms — Motor de Fichas de Cadastro Latitudes

O **LatForms** transforma contatos exportados do RD Station (CSV) em **fichas online com o visual do PDF "Ficha de Cadastro Latitudes"**. A consultora envia ao cliente um **link com token**; o cliente **preenche a ficha direto no navegador** (autosave por campo) e a consultora **acompanha em tempo real** no painel: campo alterado fica **amarelo**, campo em que o cliente está agora fica com **contorno azul**. Só a equipe interna (consultoras) faz login. O plano completo está em `PLANO_IMPLEMENTACAO.md`.

Stack: Next.js (App Router) + TypeScript + Supabase (Auth, Postgres, Realtime) + `pdf-lib` + `papaparse` + `zod` + Tailwind/shadcn. Testes: Vitest e Playwright. Domínio em português (`cliente`, `ficha`, `consultora`, `DadosFicha`), termos técnicos em inglês.

Hospedagem: **Vercel + Supabase Free + GitHub Free. Custo zero, e precisa continuar assim.**

## Decisões desta implementação (29/09/2026) — prevalecem sobre o texto abaixo

Aprovadas pela responsável ao iniciar a v3:

1. **Ficha com os 71 campos** (66 do formulário do RD + 5 do modelo de 2024), não os 35 do modelo Scribus. A definição dos campos (rótulo, tipo, origem no RD, seção) fica em `src/lib/ficha/campos.ts`; o **`src/lib/ficha/ficha-layout.json` é gerado** a partir do gerador do PDF (`npm run ficha:layout`) com o mesmo formato descrito aqui (`chave`, `rotulo`, `tipo`, `campoPdf`, `opcoes`, `pos` em % da página) **mais `pagina`**, porque a ficha tem várias páginas A4. Fundos: `public/ficha/pagina-<n>.webp`. Um teste garante que o JSON está em sincronia com o gerador. O modelo de 2024 fica só como referência em `docs/modelo-2024/`; o PDF final é o gerado pelo sistema (`lib/ficha/pdf/gerar.ts`), preenchido com `dados_atuais`.
2. **Reimportação do RD:** a ficha acompanha o RD (`dados_originais` e `dados_atuais` atualizados) enquanto o cliente **não editou nenhum campo** (status `gerada`, `enviada`, `aberta`). Depois da primeira edição (`em_preenchimento` em diante), a importação atualiza só o cliente; a ficha não é tocada e o painel mostra as diferenças do RD para consulta. Uma ficha ativa por cliente (índice único).
3. **Next.js 16** com `src/proxy.ts` (não `middleware.ts`); chaves novas do Supabase: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e **`SUPABASE_SECRET_KEY`** (a `service_role` legada deixa de existir no fim de 2026).
4. **Equipe gerenciada no app** (`/admin/equipe`: convite por link de uso único, link de nova senha, remover acesso), em vez de criar consultoras no painel do Supabase. Tabela `consultoras` (antes `funcionarios`), função `is_consultora()`.
5. **Status `aberta`** é marcado no primeiro sinal de presença do navegador (JavaScript rodando), não no GET da página: pré-visualizações de link (WhatsApp, e-mail) também abrem a URL.
6. Envio de links pela equipe: botão **"Enviar pelo Outlook"** (Outlook na web, Microsoft 365 da Latitudes) + copiar mensagem.
7. Pendências com padrão definido (TODO no código): verificação da data de nascimento atrás de `EXIGIR_VERIFICACAO` (desligada); campo revertido ao original não fica amarelo (histórico registra); obrigatórios para concluir em `layout.ts` (nome, nascimento, CPF, celular, e-mail, contato e telefone de emergência); consultora só visualiza (`origem = 'consultora'` preparado no banco).

Lições já aprendidas neste projeto (manter):
- `supabase config push` aplica direto: prévia só com `supabase config diff`. `[auth.email] enable_signup` desliga o login por e-mail inteiro; para fechar cadastro use só `[auth] enable_signup = false`.
- Arquivos lidos do disco em runtime: caminho **literal** em `path.join(process.cwd(), 'assets', …)` (com variável o Turbopack inclui o projeto inteiro) + `outputFileTracingIncludes` no `next.config.ts`.
- `proxy.ts` não redireciona `/login` → `/admin` por sessão (JWT de conta removida → loop).
- Formulários client com `fetch`: `onSubmit` + `preventDefault` (não `<form action={fn}>`).
- `Cache-Control` de páginas só é confiável em `next build && next start`.
- No Windows, parar o servidor em background não mata o `node`: conferir a porta 3000 antes de testar.

## Restrições de custo zero (obrigatórias)

- **Nenhum serviço, SDK ou dependência paga** (nem trial): nada de Upstash, Resend, Pusher, Ably, Liveblocks, Sentry pago, Vercel KV/Blob/Postgres, Password Protection. Tempo real é **só Supabase Realtime**. Se algo parecer exigir serviço pago, parar e perguntar.
- **Supabase Storage não é usado.** Não há upload de arquivo. PDF é gerado sob demanda.
- CSV importado é processado em memória e descartado.
- Rate limit com a função Postgres `consumir_rate_limit`.
- Cron: 1x por dia (`/api/cron/manutencao`), protegido por `CRON_SECRET`.
- Sem Docker: dev usa o projeto Supabase Free `latforms-dev`; migrations com `supabase link` + `supabase db push`. Máximo 2 projetos Supabase.
- Realtime Free = 200 conexões simultâneas e 2 M mensagens/mês → **só consultoras conectam**; cliente fala apenas com a API. Broadcast só após gravação real (valor mudou) e presença só na troca de campo + heartbeat 30 s.
- Funções em `gru1`, Supabase em `sa-east-1`. Hospedagem é somente Vercel.

## Regras invioláveis

1. **Nunca salvar o token puro.** Só `sha256(token)`; o token aparece uma única vez.
2. **`SUPABASE_SERVICE_ROLE_KEY` só no servidor** (`lib/supabase/admin.ts` com `import 'server-only'`).
3. **O cliente nunca se conecta ao Supabase** (nem anon key, nem Realtime). Toda leitura/escrita do cliente passa pelas rotas `/api/f/[token]/*`.
4. **Realtime só em canal privado** `ficha:<id>`, com política RLS em `realtime.messages` restrita a consultoras. Nunca usar canal público nem Postgres Changes sem RLS.
5. **Nunca logar valores de campos** (dados de saúde = sensível LGPD). Logar só IDs e nomes de campo.
6. **Não inferir dados de saúde** que o cliente não informou.
7. Token inválido, expirado ou revogado → **404 genérico**.
8. `/f/*` e `/api/f/*`: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, rate limit.
9. **O banco é a fonte da verdade.** Realtime só avisa; ao montar a tela, reconectar ou voltar à aba, a consultora recarrega o estado do banco.
10. Escrita de campo **sempre** via RPC `atualizar_campo` (atômica + histórico). Nunca sobrescrever `dados_atuais` inteiro.
11. `PATCH /campos` aceita só chaves de `ficha-layout.json` e valida o valor com zod.

## 1. Parse do CSV do RD Station (`lib/rd/parse-csv.ts`)

- Encoding: UTF-8 (com ou sem BOM). Se aparecer `�`, reprocessar como `windows-1252` (`TextDecoder`).
- **A primeira linha é `sep=,`** → remover se começar com `sep=` e usar o caractere após `=` como delimitador.
- `papaparse` com `header: true`, `skipEmptyLines: 'greedy'`.
- **Normalizar cabeçalhos**: `h.replace(/\s+/g, ' ').trim()`. Existem cabeçalhos com espaço inicial e espaços duplos (ex.: `" Por favor, descreva  os medicamentos de uso contínuo:"`).
- Normalizar valores: trim; `""`, `"n/a"`, `"N/A"`, `"-"` → `null`.
- Chave única do contato: coluna **`ID`** (ID do RD). Linha sem `ID` → erro de linha, não aborta a importação.
- Coluna `ID da Empresa` é ignorada.
- Guardar a linha normalizada inteira em `clientes.dados_rd` (jsonb) para auditoria/reprocessamento.

## 2. Normalizadores (`lib/ficha/normalizers.ts`)

| Função | Regra |
|---|---|
| `data(v)` | Aceita `AAAA-MM-DD`, `DD/MM/AAAA`, `D/M/AAAA` → saída `DD/MM/AAAA`. Inválida → `null` + aviso |
| `cpf(v)` | Só dígitos; se 11 dígitos → `000.000.000-00`; senão mantém original + aviso |
| `cep(v)` | Só dígitos; se 8 → `00000-000` |
| `telefone(v)` | Pode vir `"+55 (19) 99635-4014;019996354014"` → usar o **primeiro** antes de `;`. Formatar `(DD) 90000-0000`; remover `+55`/zero de operadora |
| `simNao(v)` | `sim`, `s`, `yes`, `Sim!` → `'Sim'`; `nao`, `não`, `n`, `Não!` → `'Não'`; outro → `null` (comparar sem acento, minúsculo, sem pontuação) |
| `juntar(...partes)` | Remove nulos/vazios/duplicados e une com `' — '` |
| `texto(v)` | Trim e colapsa espaços |

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

## 4. Mapeamento CSV → Ficha (`lib/ficha/mapping.ts`)

Nomes de coluna **já normalizados** (trim + espaços colapsados). "→ cliente" = sem fonte no CSV, fica em branco.

| Campo ficha | Coluna(s) do CSV | Regra |
|---|---|---|
| nomeCompleto | `Nome` | `texto` |
| nascimento | `data nascimento` | `data` |
| cpf | `CPF` | `cpf` |
| rg | `RG` | `texto` |
| passaporte | `Nº do passaporte` | `texto`, maiúsculas |
| vencimentoPassaporte | `Data de expiração:` | `data` (**não** usar a do passaporte estrangeiro) |
| nacionalidade | `Nacionalidade` | `texto` |
| cep | `CEP` | `cep` |
| endereco | `Endereço` | `texto` |
| numeroComplemento | `Número` + `Complemento` | `juntar` com `' / '` |
| bairro | `Bairro` | `texto` |
| cidade | `Cidade` | `texto` |
| estado | `Estado` ?? `Estado:` | primeiro não vazio |
| pais | `País` | `texto`; se vazio e nacionalidade brasileira → `Brasil` |
| celular | `Telefone` | `telefone` |
| email | `Email` | minúsculo |
| profissao | `Cargo` | `texto` |
| estadoCivil | — | → cliente |
| contatoEmergencia | `Nome do contato (emergências)` + `Grau de parentesco (emergências)` | `"Nome (Parentesco)"` |
| telefoneEmergencia | `Telefone de contato (emergências)` | `telefone` |
| medicamentoRegular | `Faz uso de medicamento contínuo?` + `Por favor, descreva os medicamentos de uso contínuo:` | Se descrição existe → descrição; senão se `simNao = Não` → `"Não"`; senão `null` |
| alergias | `Possui alergias?` + `Por favor, descreva suas alergias:` + `Por favor, descreva alimentos que você tem alergia e não pode ingerir em hipótese alguma:` | Descrições com `juntar`; se nenhuma e `Não` → `"Não"` |
| tipoSanguineo | `Tipo sanguíneo` | maiúsculas, sem espaços (`O+`) |
| convenioMedico | — | → cliente |
| antecedentesClinicos | `Por favor, descreva sua doença crônica ou patologia:`, `Descreva o motivo e a data do procedimento` (prefixo `"Cirurgia: "`), `Por favor, descreva alguma questão médica relevante que queira nos comunicar:` | `juntar` |
| condicionamentoFisico | — | → cliente (não inferir de "pratica atividade física") |
| sabeNadar | `Você sabe nadar?` | `simNao` |
| diabetico | — | → cliente |
| disturbioCardioRespiratorio | — | → cliente |
| restricoesAlimentares | `Você segue alguma dieta?`, `Segue alguma dieta?` + textos de restrição | `'Sim'` se alguma dieta = Sim **ou** houver descrição; `'Não'` se dieta = Não e sem descrição; senão `null` |
| descricaoRestricoes | `Qual dieta?` (prefixo `"Dieta: "`), `Por favor, detalhe ao máximo suas restrições alimentares`, `Descreva alimentos que você não come por gosto, dieta ou restrição` | `juntar` |
| vacinaTetano | `Vacinas que você já tomou` | contém `tetano`/`tétano`/`dt`/`dtpa` (sem acento, minúsculo) |
| vacinaFebreAmarela | `Vacinas que você já tomou` | contém `febre amarela` |
| vacinaCovid | `Vacinas que você já tomou`, `Você possui certificado de vacinação contra a COVID-19?` | contém `covid` **ou** certificado = Sim |
| outrasObservacoes | `Comentário ou infos extras`, `Comentários ou informações extras que considere necessários`, `Por favor, descreva alguma restrição física ou de mobilidade:` (prefixo `"Mobilidade: "`), `Gostaria de fazer alguma observação ou solicitação extra?`, `Como gostaria de ser chamada(0) durante a viagem?` (prefixo `"Prefere ser chamado(a): "`) | `juntar` com `'\n'` |

Colunas do CSV sem uso na ficha (manter só em `dados_rd`): dados de RD/marketing (`Contato e envio...`, `Como conheceu a Latitudes?`, catálogos), altura, peso, calçado, roupa, assento, idiomas, aeroporto, acompanhantes, endereço de entrega, passaporte estrangeiro, RNE, dados do médico, check-up, álcool, psiquiátrico, odontológico, `Observações para uso interno` (**nunca** vai para o PDF do cliente).

**Caso de teste de referência** (linha "Weimar" do CSV de exemplo): nascimento `18/03/1945`, CPF `156.253.718-06`, passaporte `GB453155`, vencimento `09/02/2030`, tipo sanguíneo `O+`, sabeNadar `Sim`, vacinas febre amarela ✔ covid ✔ tétano ✘, contatoEmergencia `Vilma Aparecida Gaisdorf (Secretaria)`, outrasObservacoes contém `dificuldade em longas caminhadas`.
Linha "Walter": nascimento `1960-02-19` → `19/02/1960`; telefone com `;` usa o primeiro.
Linha "Washington": quase vazia → ficha gerada só com nome, e-mail e celular, sem erro.

## 5. Campos do PDF modelo (referência)

Template: `assets/templates/ficha-cadastro-2024.pdf` (A4, 1 página, Scribus, `NeedAppearances = true`). Os nomes internos são genéricos. A relação abaixo é a mesma que está em `ficha-layout.json` (campo `campoPdf`) — em código, **derivar de `ficha-layout.json`** (seção 6), não copiar esta tabela:

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
```

Opções dos dropdowns (primeira opção é o placeholder `---Selecione---`, que representa `null`):
- `Lista suspensa58`: Solteiro, Casado, Separado, Divorciado, Viúvo
- `Copiar de Lista suspensa58`: Ótimo, Bom, Razoável, Ruim
- `(2)`, `(3)`, `(4)`, `(5)`: Sim, Não

Fonte padrão dos campos: 10 pt (texto) e 12 pt (dropdown). Não existe campo "nome da viagem".

## 6. Layout da ficha web (`lib/ficha/ficha-layout.json` + `lib/ficha/layout.ts`)

`ficha-layout.json` é a **fonte da verdade** dos campos: `chave`, `rotulo`, `tipo` (`texto` | `data` | `textoLongo` | `select` | `checkbox`), `campoPdf`, `opcoes` (selects) e `pos` em **% da página** (`left`, `top`, `width`, `height`, origem no canto superior esquerdo). Já está ordenado na ordem de leitura da ficha. `CAMPOS_PDF` (seção 5) deve ser **derivado** dele em `layout.ts`, não duplicado à mão; um teste garante que as chaves batem com `DadosFicha`.

Fundo: `public/ficha/ficha-bg.webp` (1191×1684 px, 144 dpi), página do modelo **sem os widgets** e sem o parágrafo "salve o arquivo no seu computador" (a faixa branca no topo é onde entram as instruções em HTML). Proporção da página: `aspect-ratio: 595.276 / 841.89`.

## 7. Componentes da ficha (`components/ficha/`)

**`<FichaDocumento>`** (≥ 768 px)
```tsx
type Props = {
  modo: 'cliente' | 'consultora';
  valores: DadosFicha;           // dados_atuais
  originais?: DadosFicha;        // dados_originais (só consultora)
  campoEmFoco?: string | null;   // presença do cliente (só consultora)
  recentes?: Set<string>;        // campos que acabaram de mudar (piscar)
  somenteLeitura?: boolean;
  onChange?: (campo: keyof DadosFicha, valor: unknown) => void;
  onFocusCampo?: (campo: keyof DadosFicha | null) => void;
};
```
- Container `position: relative; width: 100%; max-width: 900px; aspect-ratio: 595.276/841.89; background: url(/ficha/ficha-bg.webp) 0 0 / 100% 100%`.
- Cada campo `position: absolute` com `left/top/width/height` em % do JSON; `box-sizing: border-box`.
- Tamanho da fonte proporcional à largura: usar container queries (`container-type: inline-size`) e `font-size: calc(10 / 595.276 * 100cqw)` (texto) e `calc(12 / 595.276 * 100cqw)` (select). Mínimo 11 px.
- `textoLongo` → `<textarea>` sem resize, rolagem interna; `select` → `<select>` com opção vazia "Selecione"; `checkbox` → checkbox estilizado do tamanho da caixa.
- Estilo base igual ao modelo: fundo `#CFD6DA`, texto `#171614`, sem borda, `padding: 0 .4em`.
- Cada campo tem `aria-label={rotulo}` e `data-campo={chave}`; `tabIndex` segue a ordem do JSON.

**`<FichaLista>`** (< 768 px) — mesmos props. Campos empilhados, rótulo acima, agrupados em seções: Dados pessoais (nome, nascimento, nacionalidade, profissão, estado civil) · Documentos (CPF, RG, passaporte, vencimento) · Endereço · Contato (celular, e-mail) · Emergência · Saúde (medicamento, alergias, tipo sanguíneo, convênio, antecedentes, condicionamento, nadar, diabético, cardio) · Alimentação · Vacinas · Observações. Inputs com `font-size ≥ 16px` (evita zoom no iOS), `inputMode`/`autocomplete` adequados.

**Estados visuais (modo consultora)** — definir em `LegendaCores` e usar tokens CSS:

| Estado | Regra | Visual |
|---|---|---|
| Alterado | `!igual(valores[k], originais[k])` (função `diff.ts`, normaliza trim/null/"") | fundo **amarelo** `#FFE58F`, borda `#E0A800`, ícone ✎; tooltip "Antes: <valor ou (vazio)> · Alterado às HH:mm" |
| Editando agora | `campoEmFoco === k` e cliente online | contorno **azul** 2 px `#2563EB` + etiqueta flutuante "Cliente editando" |
| Recém-alterado | chave em `recentes` | animação de pulso 2 s (respeitar `prefers-reduced-motion`) |
| Normal | — | cinza do modelo |

No modo cliente **não** mostrar amarelo; mostrar só um ✓ discreto no campo recém-salvo.

## 8. Autosave e presença do cliente (`hooks/useAutosave.ts`, `hooks/usePresenca.ts`)

- `useAutosave`: fila por campo; envia `PATCH /api/f/[token]/campos { campo, valor }` após **800 ms** sem digitar ou imediatamente no `blur`; selects e checkboxes enviam na hora. Só o último valor pendente de cada campo é enviado. Retry com backoff (1 s, 2 s, 5 s, 10 s). Estado global: `salvando | salvo | offline | erro`. `beforeunload` avisa se houver pendência; ao voltar online, esvazia a fila.
- Validação no cliente com o mesmo schema zod (feedback imediato: "CPF inválido"); valor inválido **não** é enviado.
- `usePresenca`: `POST /api/f/[token]/presenca { campo }` no focus e `{ campo: null }` no blur (throttle 1 s); heartbeat a cada 30 s só com `document.visibilityState === 'visible'`.
- Após `concluir` (status `concluida`), tudo em somente leitura e mensagem "Ficha enviada, obrigado!" + botão "Baixar cópia em PDF".

## 9. Rotas do cliente (server)

Todas: resolver token (`hashToken` → `tokens_acesso` válido) → rate limit → auditoria.

- `GET /f/[token]`: server component; carrega `dados_atuais` e status; marca `aberta` no 1º acesso; renderiza `<FichaDocumento modo="cliente">` / `<FichaLista>`. Faixa de instruções no topo: "Confira seus dados e complete o que faltar. Tudo é salvo automaticamente. Ao terminar, clique em Concluir ficha."
- `PATCH /api/f/[token]/campos`: 60 req/min por token. Rejeita se status ∈ {`concluida`,`aprovada`,`cancelada`}. Valida chave e valor → `rpc('atualizar_campo', { p_ficha, p_campo, p_valor, p_origem: 'cliente' })` → se retornou não-nulo, `broadcast('campo_atualizado', retorno)` → responde `{ ok: true, salvoEm }`.
- `POST /api/f/[token]/presenca`: atualiza `campo_em_foco` e `cliente_visto_em` → `broadcast('presenca', { campo, em })`.
- `POST /api/f/[token]/concluir`: checa obrigatórios (lista em `layout.ts`, confirmar com o responsável) → status `concluida` → `broadcast('status', …)`.
- `GET /api/f/[token]/pdf`: só se `concluida`/`aprovada`.

## 10. Realtime (`lib/realtime/broadcast.ts`, `hooks/useFichaAoVivo.ts`)

**Servidor → canal privado** (Route Handler na Vercel, sem WebSocket persistente):
```ts
export async function broadcast(fichaId: string, event: string, payload: object) {
  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: [{ topic: `ficha:${fichaId}`, event, payload, private: true }] }),
  });
}
```
Falha no broadcast **não** falha a requisição (o dado já está no banco); só registra aviso.

**Consultora ← canal** (`useFichaAoVivo(fichaId)`):
```ts
await supabase.realtime.setAuth();              // usa o JWT da sessão
const ch = supabase.channel(`ficha:${fichaId}`, { config: { private: true } })
  .on('broadcast', { event: 'campo_atualizado' }, ({ payload }) => aplicarCampo(payload))
  .on('broadcast', { event: 'presenca' },        ({ payload }) => setFoco(payload))
  .on('broadcast', { event: 'status' },          ({ payload }) => setStatus(payload))
  .subscribe((s) => { if (s === 'SUBSCRIBED') recarregarDoBanco(); });
```
- `recarregarDoBanco()` também em `visibilitychange` → visible e em reconexão.
- "Cliente online" = `cliente_visto_em` < 60 s (reavaliar a cada 10 s no front).
- Lista `/admin` assina um canal `fichas:lista` (mesma política, `topic like 'fichas:%'`) para status e contadores; o servidor publica nele junto com o canal da ficha.

Política RLS (migration):
```sql
create policy "consultoras recebem broadcast"
on realtime.messages for select to authenticated
using ( (realtime.topic() like 'ficha:%' or realtime.topic() = 'fichas:lista')
        and exists (select 1 from consultoras where id = auth.uid()) );
```
No painel do Supabase: Realtime → Settings → desativar "Allow public access".

## 11. Painel da consultora `/admin/fichas/[id]`

- Layout: ficha (modo consultora, somente leitura) à esquerda; à direita `<PainelAtividade>`: selo de status, "Cliente online/offline · visto há X", contador "N campos alterados", filtro "Mostrar só alterados" (esmaece os demais), histórico de `ficha_edicoes` (campo, antes → depois, hora; clicar rola até o campo e pisca), legenda de cores.
- Ações: gerar/revogar link, copiar link, copiar mensagem (texto para WhatsApp/e-mail), aprovar, reabrir, baixar PDF, cancelar.
- Em telas pequenas, painel vira aba.

## 12. PDF final (`lib/ficha/pdf/fill.ts`)

Gerado **sob demanda** de `dados_atuais`, só para download (`GET /api/fichas/[id]/pdf` e cópia do cliente após concluir). `runtime = 'nodejs'`; template lido de `assets/templates/` e cacheado em variável de módulo.

```ts
export async function preencherFicha(template: Uint8Array, d: DadosFicha) {
  const pdf = await PDFDocument.load(template);
  const form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica); // WinAnsi cobre acentos PT-BR
  for (const c of CAMPOS) {                                   // de layout.ts
    const campo = form.getField(c.campoPdf);
    const v = d[c.chave];
    if (campo instanceof PDFTextField) { campo.setText((v as string) ?? ''); ajustarFonte(campo, (v as string) ?? '', font); }
    else if (campo instanceof PDFDropdown) { if (v) campo.select(v as string); }
    else if (campo instanceof PDFCheckBox) { v ? campo.check() : campo.uncheck(); }
  }
  form.updateFieldAppearances(font);
  pdf.setTitle(`Ficha de Cadastro — ${d.nomeCompleto ?? ''}`); pdf.setProducer('LatForms — Latitudes');
  return pdf.save();
}
```
- `select()` lança erro com valor fora das opções → validar antes.
- `ajustarFonte`: reduz até 6 pt se o texto não couber.
- Arquivo: `Ficha_Cadastro_<Nome_Sobrenome_sem_acento>_<AAAA-MM-DD>.pdf`. Não achatar (a equipe pode querer ajustar no Acrobat).

## 13. Tokens (`lib/tokens.ts`)

```ts
import { randomBytes, createHash } from 'node:crypto';
export const gerarToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
```
Validade `TOKEN_TTL_DIAS` (padrão 15). Novo link revoga os anteriores. Busca por `token_hash`, checa `revogado_em is null` e `expira_em > now()`, incrementa `usos`/`ultimo_acesso_em`. URL `${APP_URL}/f/${token}` (nunca em query string).

## 14. Área interna

- `middleware.ts` protege `/admin/*` e `/api/*` (exceto `/api/f/*` e `/api/cron/*`); checar `auth.uid()` em `consultoras`.
- Signup desativado; consultoras criadas manualmente no painel do Supabase e inseridas em `consultoras`.
- Importação: prévia (`dryRun`) → confirmação; upsert por `rd_id`; não altera fichas já geradas (avisar se `dados_ficha` mudou depois da geração).
- Ao gerar ficha: `dados_originais = dados_atuais = clientes.dados_ficha`.

## 15. Rate limit (migration)

```sql
create or replace function consumir_rate_limit(p_chave text, p_limite int, p_janela_seg int)
returns boolean language plpgsql security definer as $$
declare v_ok boolean;
begin
  insert into rate_limit as r (chave, janela_inicio, contagem) values (p_chave, now(), 1)
  on conflict (chave) do update set
    contagem      = case when r.janela_inicio < now() - make_interval(secs => p_janela_seg) then 1 else r.contagem + 1 end,
    janela_inicio = case when r.janela_inicio < now() - make_interval(secs => p_janela_seg) then now() else r.janela_inicio end
  returning contagem <= p_limite into v_ok;
  return v_ok;
end $$;
```

## 16. Testes obrigatórios

- Unit: parser, normalizadores, cada regra de mapeamento, casos de referência da seção 4; `diff.ts` (null = "" = "  "; checkbox false vs null); `layout.ts` (chaves do JSON = chaves de `DadosFicha` = campos do PDF).
- `atualizar_campo`: valor igual não gera histórico nem broadcast; valor novo gera 1 linha.
- Rotas do cliente: token inválido → 404; chave fora do layout → 400; valor inválido → 422; ficha concluída → 409; rate limit → 429.
- Realtime: usuário anônimo não recebe mensagens de `ficha:<id>`.
- E2E (Playwright, **2 contextos**): consultora abre `/admin/fichas/[id]`; cliente abre `/f/<token>`, clica em "Alergias" → consultora vê contorno azul; cliente digita → consultora vê o campo **amarelo** com o novo valor em < 2 s; cliente recarrega → valor persiste; cliente conclui → consultora vê status "Concluída".
- Visual: screenshot de `<FichaDocumento>` em 1280 px comparado com baseline (campos sobre as caixas).
- PDF: gerar a partir de `dados_atuais` → reler com pdf-lib → valores iguais; acentos ok.
- Fixture CSV anonimizada; nunca commitar dados reais.
- CI (`ci.yml`): lint, typecheck, Vitest. E2E local contra `latforms-dev`.

## 17. Operação no plano gratuito

`vercel.json`:
```json
{ "regions": ["gru1"], "crons": [{ "path": "/api/cron/manutencao", "schedule": "0 9 * * *" }] }
```
`/api/cron/manutencao` (idempotente, `Authorization: Bearer ${CRON_SECRET}`): `select 1` (keep-alive) → limpa `rate_limit` > 1 dia → tokens expirados > 30 dias → `ficha_edicoes` de fichas aprovadas > 180 dias → registra em `auditoria`.

`.github/workflows/backup.yml` (diário): `pg_dump "$SUPABASE_DB_URL" --no-owner -Fc` → `gpg --batch --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE"` → `actions/upload-artifact` (`retention-days: 30`). Nunca publicar dump sem criptografia.

## 18. Convenções

- Route handlers retornam `{ ok: true, data } | { ok: false, erro }`.
- Mensagens ao usuário em português, tom acolhedor (o cliente é viajante, não técnico).
- Conventional Commits.
- Antes de concluir qualquer tarefa: `npm run lint && npm run typecheck && npm test`.
