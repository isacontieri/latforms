# LatForms — Motor de Fichas de Cadastro Latitudes
Plano de implementação (para desenvolvimento com Claude Code)
**Versão 3: 100% com ferramentas e planos gratuitos (Vercel Hobby + Supabase Free)**

## 1. Objetivo

A equipe interna importa o CSV exportado do RD Station. O motor transforma cada contato numa **Ficha de Cadastro Latitudes em PDF preenchível**, já pré-preenchida com o que o cliente informou no formulário. **Todas as colunas do CSV são extraídas e guardadas**, inclusive as que não têm campo no PDF (altura, médico, aeroporto, acompanhantes etc.), e ficam visíveis para a equipe e na exportação. Cada ficha fica disponível num **link com token** que a equipe copia e envia ao cliente pelos canais que já usa (o sistema não se integra a nenhum serviço de mensagem). O cliente abre o link, baixa o PDF, confere/completa os dados e devolve o arquivo pelo mesmo link.

Dois tipos de acesso:
- **Funcionários:** login com e-mail + senha (Supabase Auth), área `/admin`.
- **Clientes:** sem login; acesso só pelo link `/f/<token>`.

**Fluxo:**

```
RD Station ──export CSV──▶ [Funcionário logado] Importar CSV
                                   │  (CSV lido no navegador, enviado em lotes)
                                   ▼
                     Parser + normalização + mapeamento (servidor)
                                   │
                                   ▼
                 Cliente salvo no banco (upsert pelo ID do RD)
                                   │
                                   ▼
                Gera link /f/<token>  ──(equipe copia e envia ao cliente)
                                   │
                                   ▼
   Cliente abre o link ▶ baixa o PDF gerado na hora (template + dados, pdf-lib)
                                   │
                                   ▼
   Cliente confere/completa ▶ envia o PDF pelo mesmo link
   (upload direto para o Supabase Storage via URL assinada)
                                   │
                                   ▼
     Motor valida e lê os campos do PDF ▶ status "respondida"
                                   │
                                   ▼
   Funcionário revisa ▶ aprova, pede correção, baixa o PDF ou exporta CSV
```

## 2. Custo: R$ 0

| Ferramenta | Uso no projeto | Plano | Custo |
|---|---|---|---|
| Vercel | Hospedagem do Next.js + cron diário | Hobby | Grátis |
| Supabase | Postgres, Auth, Storage | Free | Grátis |
| GitHub | Repositório privado **em conta pessoal** + Actions (CI e backup) | Free | Grátis |
| Next.js, TypeScript, Tailwind, shadcn/ui | App | Open source | Grátis |
| pdf-lib, papaparse, zod | PDF, CSV, validação | Open source | Grátis |
| Vitest, Playwright | Testes | Open source | Grátis |
| Node.js, VS Code, Supabase CLI | Ambiente de desenvolvimento | Open source | Grátis |

**Fora do projeto para não gerar custo:** Upstash (rate limit é feito no Postgres), Docker Desktop (o dev usa um 2º projeto Supabase Free), serviço de e-mail transacional e integrações com mensageiros (a equipe copia o link e envia manualmente).

> O Claude Code, usado para escrever o código, não faz parte do sistema e exige plano pago do Claude — ele é ferramenta de desenvolvimento, não de execução. O sistema em si roda sem nenhum custo.

## 3. ⚠️ Pontos de atenção dos planos gratuitos

| Risco | Detalhe | Como o projeto contorna |
|---|---|---|
| **Vercel Hobby é "não comercial"** | Os termos limitam o Hobby a uso pessoal e não comercial. Um sistema interno da Latitudes pode ser considerado uso comercial e a Vercel pode suspender o projeto. | Verificar em qual conta/plano a Latitudes já usa a Vercel. Se houver time Pro, criar o projeto nele. Se não, **levar esse ponto ao gestor**. |
| **Vercel Hobby não faz deploy de repositório privado de organização do GitHub** | Só repositório privado de conta pessoal (ou repositório público de organização). | Repositório privado na conta pessoal de quem mantém o projeto, com os demais como colaboradores. Se o repo precisar ficar na organização da Latitudes, é preciso Vercel Pro. |
| Supabase pausa após 1 semana sem uso | Os dados não se perdem, mas o link do cliente para de funcionar até alguém reativar. | Vercel Cron diário chama `/api/cron/manutencao`, que faz uma consulta no banco. |
| Supabase Free: 2 projetos ativos **por conta** | Se a conta já tiver outro projeto Free, não cabem `dev` + `prod`. | Usar uma conta/organização Supabase dedicada ao LatForms. |
| Supabase Free não tem backup | Sem backup automático nem restauração pontual. | GitHub Actions diário faz `pg_dump` (dados do `public` + usuários do `auth`), criptografa com `gpg` e guarda como artefato por 30 dias. **Os PDFs do Storage não entram no backup** (os dados lidos deles, sim, estão no banco). |
| Storage de 1 GB | Um PDF da ficha tem ~1,2 MB → ~800 arquivos. | PDFs gerados **não são guardados**. CSV **não é guardado**. Só o PDF devolvido pelo cliente fica no Storage, apagado 90 dias após a aprovação; uploads não confirmados são apagados em 1 dia. |
| Banco de 500 MB | | Suficiente para dezenas de milhares de fichas (~10 KB de JSON cada). |
| Vercel: corpo da requisição ≤ 4,5 MB | Vale para o CSV e para o PDF. | PDF do cliente vai **direto para o Supabase Storage** (URL assinada). O CSV é lido no navegador e enviado em **lotes de até 200 linhas** em JSON. |
| URL assinada de upload vale 2 h (fixo) | O Supabase não permite prazo menor. | A URL só grava num caminho novo e único (`upsert: false`), e nada vale até passar pela validação de `/confirmar`. |
| Vercel Hobby: cron só 1x por dia | Horário aproximado (dentro da hora). | Suficiente para keep-alive e limpeza. |
| Vercel Hobby: 4 h de CPU ativa/mês | Gerar um PDF leva ~100–300 ms. | Dá para milhares de fichas por mês. |
| Supabase: e-mail padrão tem limite baixo | Convites por e-mail podem falhar. | Funcionários criados manualmente no painel (Auth → Add user). São poucos. |
| Chaves legadas do Supabase | `anon` e `service_role` serão descontinuadas no fim de 2026. | Usar desde o início as chaves novas: **publishable** (`sb_publishable_…`) e **secret** (`sb_secret_…`). |
| Logs curtos | Vercel guarda 1 h; Supabase 1 dia. | Tabela `auditoria` própria no banco. |

## 4. Decisões

| Tema | Decisão |
|---|---|
| Stack | Next.js 16 (App Router, `proxy.ts`) + TypeScript + Supabase (Auth, Postgres, Storage) |
| Região | Supabase em `sa-east-1` (São Paulo); funções Vercel em `gru1` (`vercel.json` → `"regions": ["gru1"]`) |
| Login | Somente funcionários (Supabase Auth, e-mail + senha, cadastro público desativado) |
| Autorização | `proxy.ts` só renova a sessão e redireciona para `/login`. **A checagem de funcionário (`funcionarios`) é feita em cada layout/route handler** com `exigirFuncionario()` |
| Acesso do cliente | Sem login. Link `/f/<token>` com token aleatório de 32 bytes, guardado como hash SHA-256, com expiração e revogação |
| Saída | PDF preenchível (AcroForm) gerado **sob demanda** a partir do modelo, **sem achatar** |
| Entrada | CSV exportado manualmente do RD Station |
| Rate limit | Função no Postgres (tabela `rate_limit`), executável só pelo servidor |
| Ambientes | 2 projetos Supabase Free: `latforms-dev` e `latforms-prod` |
| Domínio | `latforms.vercel.app` (gratuito) |

## 5. O que já foi analisado nos arquivos

**CSV do RD Station**
- UTF-8 (pode ter BOM), separador vírgula, **primeira linha é `sep=,`** (descartar antes do parse, depois de remover o BOM); cabeçalho na linha 2.
- 98 colunas, todas catalogadas em `.claude/skills/ficha-cadastro-latitudes/colunas-rd.md` (chave, grupo, tipo, se é dado de saúde). Alguns cabeçalhos têm espaço no início ou espaços duplos → normalizar (trim + colapsar espaços).
- Colunas quase duplicadas que são combinadas: `Estado` / `Estado:`, `Segue alguma dieta?` / `Você segue alguma dieta?`, `Comentário ou infos extras` / `Comentários ou informações extras...`, as duas perguntas de mídia digital/impressa.
- `Nº do passaporte` e `N° Passaporte estrangeiro` usam símbolos diferentes (º ordinal × ° grau) — não unificar.
- `Primeiro nome` às vezes traz o nome completo → a página do cliente usa a primeira palavra de `Nome`.
- Colunas de texto livre às vezes trazem só "Não!" → tratadas como vazias.
- Formatos inconsistentes: data de nascimento vem como `1960-02-19` **ou** `18/03/1945`; telefone pode vir com vários números separados por `;`; respostas sim/não vêm como `sim`, `nao`, `Não!`.
- Contatos podem vir quase vazios (inclusive sem nome) → ainda assim geram ficha.
- Coluna `ID` = ID do contato no RD → chave única para upsert.
- Se o RD ganhar colunas novas, elas não se perdem: vão para `dados_rd.extras` e a prévia da importação avisa.
- **O export real tem dados pessoais e de saúde e não entra no repositório.** Os testes usam `tests/fixtures/rd-export.csv`, com o mesmo cabeçalho e dados fictícios.

**PDF modelo**
- 1 página A4, gerado no Scribus, 35 campos AcroForm (26 de texto, 6 dropdowns e 3 checkboxes).
- Nomes internos genéricos (`Copiar de Campo de texto20 (17)`) → mapeamento documentado na skill.
- Campos sem fonte no CSV (ficam para o cliente): Estado civil, Convênio médico, Condicionamento físico, Diabético(a)?, Distúrbio cardio-respiratório?.
- **A verificar na Fase 4:** se o template tem JavaScript embutido (ações de dropdown/formatação do Scribus). Isso define a regra de validação do upload.

## 6. Modelo de dados (Supabase)

```sql
create table funcionarios (
  id uuid primary key references auth.users on delete cascade,
  nome text not null,
  criado_em timestamptz default now()
);

-- usado pelas políticas de RLS (evita recursão ao consultar funcionarios)
create or replace function is_funcionario() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from funcionarios where id = auth.uid())
$$;

create table importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo_nome text not null,            -- só o nome; o CSV não é guardado
  total_linhas int not null,
  criados int not null default 0,
  atualizados int not null default 0,
  erros jsonb not null default '[]',
  importado_por uuid references funcionarios(id),
  criado_em timestamptz default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  rd_id text unique not null,
  nome text not null,                    -- fallback: e-mail ou '(sem nome)'
  email text,
  dados_rd jsonb not null,               -- { campos: todas as colunas do catálogo normalizadas, extras: colunas desconhecidas, original: linha bruta }
  dados_ficha jsonb not null,            -- campos mapeados para a ficha
  ultima_importacao_id uuid references importacoes(id),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create type status_ficha as enum (
  'gerada',               -- ficha criada, sem link
  'enviada',              -- link gerado
  'aberta',               -- cliente baixou o PDF
  'respondida',           -- PDF devolvido e validado
  'correcao_solicitada',  -- funcionário pediu correção; cliente pode reenviar
  'aprovada',
  'cancelada'
);

create table fichas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  versao int not null default 1,
  status status_ficha not null default 'gerada',
  dados_snapshot jsonb not null,         -- dados_ficha no momento da geração (PDF é regerado a partir daqui)
  pdf_respondido_path text,              -- storage: fichas-respondidas/
  dados_respondidos jsonb,
  motivo_correcao text,                  -- texto curto, sem dados sensíveis (aparece na página do cliente)
  criado_por uuid references funcionarios(id),
  criado_em timestamptz default now(),
  respondida_em timestamptz,
  aprovada_em timestamptz
);

create table tokens_acesso (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references fichas(id) on delete cascade,
  token_hash text unique not null,
  expira_em timestamptz not null,
  revogado_em timestamptz,
  usos int not null default 0,
  ultimo_acesso_em timestamptz,
  criado_em timestamptz default now()
);
-- no máximo 1 token ativo por ficha
create unique index tokens_um_ativo on tokens_acesso (ficha_id) where revogado_em is null;

create table auditoria (
  id bigserial primary key,
  ator text not null,
  acao text not null,
  ficha_id uuid,
  ip inet,
  user_agent text,
  criado_em timestamptz default now()
);

-- rate limit sem serviço externo
create table rate_limit (
  chave text primary key,                -- ex.: 'f:<ip>'
  janela_inicio timestamptz not null,
  contagem int not null
);

create or replace function consumir_rate_limit(p_chave text, p_limite int, p_janela_seg int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  insert into rate_limit as r (chave, janela_inicio, contagem)
  values (p_chave, now(), 1)
  on conflict (chave) do update set
    contagem     = case when r.janela_inicio < now() - make_interval(secs => p_janela_seg) then 1 else r.contagem + 1 end,
    janela_inicio= case when r.janela_inicio < now() - make_interval(secs => p_janela_seg) then now() else r.janela_inicio end
  returning contagem <= p_limite into v_ok;
  return v_ok;
end $$;

-- funções do schema public ficam expostas em /rest/v1/rpc: só o servidor pode chamar esta
revoke execute on function consumir_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function consumir_rate_limit(text, int, int) to service_role;
```

A troca de link (revogar o anterior + criar o novo) é feita numa função SQL `gerar_link(ficha_id, token_hash, expira_em)` em uma transação, com as mesmas permissões de `consumir_rate_limit`.

**RLS:** habilitado em todas as tabelas; políticas usam `is_funcionario()`. `rate_limit` fica sem políticas (só acessível pela secret key). Rotas do cliente usam a **secret key** apenas no servidor.

**Storage:** um único bucket privado `fichas-respondidas/`, limite de 5 MB por arquivo e MIME `application/pdf` (configurado no bucket). O template fica no repositório (`assets/templates/`).

## 7. Rotas

**Área interna** — `proxy.ts` redireciona quem não está logado para `/login`; o layout de `/admin` e cada route handler chamam `exigirFuncionario()` (sessão válida + registro em `funcionarios`, senão 403).

| Rota | Função |
|---|---|
| `/login` | Login dos funcionários |
| `/admin` | Lista de fichas com filtros por status e busca |
| `/admin/importar` | Selecionar CSV → prévia → confirmar |
| `/admin/clientes/[id]` | Todas as colunas do RD agrupadas, dados mapeados para a ficha, histórico, gerar ficha/link, revogar, baixar PDFs, comparar gerado × respondido, aprovar / pedir correção |

**API**

| Método | Endpoint | Auth |
|---|---|---|
| POST | `/api/importacoes` `{ arquivoNome, totalLinhas }` → cria a importação | funcionário |
| POST | `/api/importacoes/[id]/lote` `{ linhas[], dryRun }` (≤ 200 linhas) | funcionário |
| POST | `/api/fichas` `{ clienteId }` → cria ficha (snapshot dos dados) | funcionário |
| POST | `/api/fichas/[id]/link` → retorna URL com token (mostrada uma vez) | funcionário |
| DELETE | `/api/fichas/[id]/link` → revoga | funcionário |
| POST | `/api/fichas/[id]/status` `{ acao: 'aprovar' \| 'pedir_correcao' \| 'cancelar', motivo? }` | funcionário |
| POST | `/api/fichas/lote` `{ clienteIds[] }` | funcionário |
| GET | `/api/fichas/[id]/pdf?tipo=gerado\|respondido` | funcionário |
| GET | `/api/exportar?status=respondida` → CSV com todas as colunas do RD + dados respondidos | funcionário |
| GET | `/f/[token]` → página do cliente | token |
| GET | `/api/f/[token]/pdf` → gera e baixa o PDF na hora | token |
| POST | `/api/f/[token]/upload-url` → URL assinada de upload no Storage | token |
| POST | `/api/f/[token]/confirmar` → valida o PDF enviado e lê os campos | token |
| GET | `/api/cron/manutencao` → keep-alive + limpeza (`Authorization: Bearer CRON_SECRET`) | cron |

`proxy.ts` **não** intercepta `/f/*`, `/api/f/*` nem `/api/cron/*` (essas rotas têm autenticação própria).

## 8. Ciclo de vida da ficha

| De | Evento | Para |
|---|---|---|
| — | Funcionário cria a ficha | `gerada` |
| `gerada` / `enviada` / `aberta` | Funcionário gera link (revoga o anterior) | `enviada` (se ainda não aberta) |
| `enviada` | Cliente **baixa o PDF** (não basta abrir a página: pré-visualizações de link e antivírus de e-mail também abrem a URL) | `aberta` |
| `enviada` / `aberta` / `respondida` / `correcao_solicitada` | Cliente envia PDF válido | `respondida` |
| `respondida` | Funcionário pede correção (motivo curto) e avisa o cliente pelo canal de sempre | `correcao_solicitada` |
| `respondida` | Funcionário aprova | `aprovada` (upload bloqueado; download continua) |
| qualquer | Funcionário cancela | `cancelada` (token → 404) |

## 9. Segurança e LGPD

A ficha contém **dados pessoais sensíveis** (saúde, CPF, passaporte).

- Token: `crypto.randomBytes(32).toString('base64url')`; salvar só o hash; validade padrão 15 dias; revogável; novo link revoga o anterior.
- 404 genérico para token inválido, expirado, revogado ou ficha cancelada.
- Rate limit via `consumir_rate_limit`: 20 req/min por IP (`x-real-ip` da Vercel) nas rotas `/f/*` e `/api/f/*`.
- Página do token mostra só o primeiro nome; dados sensíveis só dentro do PDF.
- Upload: URL assinada (validade fixa de 2 h no Supabase), caminho novo e único `fichas-respondidas/<ficha_id>/<timestamp>.pdf`, sem sobrescrita. Na confirmação: caminho pertence à ficha do token, ≤ 5 MB, assinatura `%PDF-`, é o template correto (nomes dos campos), sem JavaScript fora do que o template já tiver; se inválido, apagar o arquivo.
- Cabeçalhos: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` em `/f/*`.
- Auditoria de todo acesso e de toda ação dos funcionários.
- Nunca logar conteúdo do CSV nem do PDF.
- Retenção (cron diário): apagar PDFs respondidos 90 dias após aprovação; apagar uploads não confirmados com mais de 1 dia; limpar `rate_limit` com mais de 1 dia; apagar tokens expirados há mais de 30 dias; anonimizar `ip`/`user_agent` da `auditoria` com mais de 180 dias (prazo a confirmar).
- Backup criptografado (GitHub Actions) com senha em GitHub Secrets; dump nunca em texto puro.
- Signup desativado no Supabase Auth (`supabase/config.toml`). Senha dos funcionários: mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial (`password_requirements = "lower_upper_letters_digits_symbols"`; o Supabase não tem a opção sem número).

## 10. Fases e critérios de aceite

### Fase 0 — Setup (0,5 dia)
- Criar conta gratuita na Vercel, conta/organização Supabase dedicada e repositório privado **na conta pessoal** do GitHub.
- Criar 2 projetos Supabase Free (`latforms-dev`, `latforms-prod`) em `sa-east-1`; gerar as chaves publishable e secret em cada um.
- Next.js 16 + TS + Tailwind + shadcn/ui; Supabase CLI (apenas para migrations: `supabase link` + `supabase db push`, sem Docker).
- `package.json` com o script `check` (lint + typecheck + testes).
- `.env.local` apontando para `latforms-dev`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `APP_URL`, `TOKEN_TTL_DIAS`, `CRON_SECRET`.
- Template em `assets/templates/ficha-cadastro-2024.pdf`; `CLAUDE.md` na raiz; skill em `.claude/skills/ficha-cadastro-latitudes/SKILL.md`; CSV anonimizado em `tests/fixtures/rd-export.csv`.
- ✅ `npm run dev` sobe conectado ao `latforms-dev`; `npm run check` passa.

### Fase 1 — Auth e layout (1 dia)
- Migrations + RLS + bucket; desativar signup; criar 1 funcionário manualmente.
- Login, logout, `proxy.ts` e `exigirFuncionario()`.
- ✅ Não logado → `/login`; logado sem registro em `funcionarios` → 403 (inclusive chamando a API direto, sem passar pelo `proxy.ts`); `/api/cron/manutencao` e `/api/f/*` não são redirecionados.

### Fase 2 — Parser e mapeamento do CSV (2 dias)
- `lib/rd/parse-csv.ts`, `lib/ficha/normalizers.ts`, `lib/ficha/mapping.ts` conforme a skill.
- Testes (Vitest) com o CSV de exemplo.
- `lib/rd/colunas.ts` (catálogo das 98 colunas) e `lib/rd/extrair.ts`.
- ✅ As 98 colunas da fixture extraídas com o tipo certo; coluna desconhecida vai para `extras`; 100% das regras da tabela de mapeamento cobertas por teste.

### Fase 3 — Importação (1 dia)
- Navegador lê o CSV (`parse-csv.ts` roda no client) → envia lotes com `dryRun: true` → mostra prévia → reenvia com `dryRun: false`. Normalização e mapeamento rodam no servidor. Nada do CSV é guardado.
- ✅ Importar o mesmo CSV duas vezes não duplica clientes; CSV com mais de 4,5 MB importa sem erro.

### Fase 4 — Geração do PDF (1,5 dia)
- Inspecionar o template (JavaScript embutido, opções dos dropdowns, conjunto de caracteres).
- `lib/ficha/pdf/fill.ts` com `pdf-lib`; geração sob demanda, sem salvar no Storage.
- ✅ Abre no Adobe Reader e no Chrome com acentos, dropdowns e checkboxes funcionando e editáveis; texto com emoji/caracteres fora do WinAnsi não quebra a geração; geração < 1 s.
- ✅ Testar também o Preview do macOS: se ele corromper o formulário ao salvar, a página do cliente recomenda o Adobe Reader e o erro 422 explica isso.

### Fase 5 — Link com token e página do cliente (1,5 dia)
- Token, revogação, "copiar link" e "copiar mensagem" (texto pronto para a equipe colar no canal que usar).
- `/f/[token]`: instruções, download, upload direto ao Storage, confirmação, aviso de correção quando houver.
- ✅ Token expirado/revogado/ficha cancelada → 404; abrir a página não muda o status, baixar o PDF muda para `aberta`; E2E do fluxo completo.

### Fase 6 — Recebimento e revisão (1,5 dia)
- `lib/ficha/pdf/read.ts`; tela de revisão com diff; aprovar / pedir correção / cancelar; exportar CSV.
- ✅ PDF preenchido no Adobe Reader e reenviado é lido por completo (fixture real salva pelo Reader em `tests/fixtures/`).

### Fase 7 — Operação gratuita e deploy (1 dia)
- `vercel.json` com `regions` e `crons` (`/api/cron/manutencao`, 1x/dia).
- `.github/workflows/backup.yml`: `pg_dump` diário do `latforms-prod` (cliente Postgres na **mesma versão major** do servidor, instalado pelo repositório PGDG) → `gpg --symmetric` → `actions/upload-artifact` (retenção 30 dias).
- Deploy na Vercel Hobby apontando para `latforms-prod`.
- README: como restaurar o backup, como reativar o Supabase se pausar, e o aviso de que os PDFs do Storage não têm backup.
- ✅ Cron executa e registra em `auditoria`; backup do dia aparece nos artefatos do GitHub; teste de restauração feito uma vez no `latforms-dev`.

**Estimativa total:** ~10 dias úteis.

## 11. Estrutura de pastas

```
.
├── CLAUDE.md
├── .claude/skills/ficha-cadastro-latitudes/{SKILL.md,colunas-rd.md}
├── .github/workflows/{ci.yml,backup.yml}
├── assets/templates/ficha-cadastro-2024.pdf
├── vercel.json
├── src/
│   ├── app/
│   │   ├── login/page.tsx
│   │   ├── admin/{layout.tsx,page.tsx,importar/page.tsx,clientes/[id]/page.tsx}
│   │   ├── f/[token]/page.tsx
│   │   └── api/
│   │       ├── importacoes/route.ts
│   │       ├── importacoes/[id]/lote/route.ts
│   │       ├── fichas/route.ts
│   │       ├── fichas/[id]/{link,pdf,status}/route.ts
│   │       ├── fichas/lote/route.ts
│   │       ├── exportar/route.ts
│   │       ├── f/[token]/{pdf,upload-url,confirmar}/route.ts
│   │       └── cron/manutencao/route.ts
│   ├── lib/
│   │   ├── supabase/{server,client,admin}.ts
│   │   ├── auth.ts                 # exigirFuncionario()
│   │   ├── rd/{parse-csv,colunas,extrair}.ts
│   │   ├── ficha/{schema,mapping,normalizers,status}.ts
│   │   ├── ficha/pdf/{fields,fill,read,winansi}.ts
│   │   ├── tokens.ts
│   │   ├── rate-limit.ts
│   │   └── audit.ts
│   └── proxy.ts
├── supabase/migrations/
└── tests/{unit,e2e,fixtures}/
```

## 12. Pontos para confirmar com a equipe

1. **Uso da Vercel Hobby para um sistema da empresa** e repositório em conta pessoal (ver seção 3).
2. Validade do link (sugestão: 15 dias).
3. Campos obrigatórios para considerar a ficha "completa".
4. Se o PDF deve incluir o nome da viagem/programa.
5. Prazo de retenção dos dados após a viagem e dos IPs da auditoria (LGPD).

## 13. Evoluções futuras
- Integração com a API do RD Station.
- Ficha web como alternativa ao PDF.
- Múltiplos modelos de ficha por tipo de viagem.
