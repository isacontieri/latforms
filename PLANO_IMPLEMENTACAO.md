# LatForms — Motor de Fichas de Cadastro Latitudes
Plano de implementação (para desenvolvimento com Claude Code)
**Versão 3: ficha preenchida direto no link + acompanhamento em tempo real pelas consultoras. Custo zero (Vercel + Supabase Free).**

## Decisões desta implementação (29/09/2026) — prevalecem sobre o texto abaixo

Aprovadas pela responsável ao iniciar a v3:

- **Banco único (30/09/2026):** o projeto Supabase `LatForms` (ref `jbxgsnrslrenkkbtqtwn`) foi transferido para a org **Latitudes Tech**, mantendo ref, chaves e dados. Ele é o banco de produção e não será criado outro (`latforms-prod`/`latforms-dev` do texto abaixo ficam sem efeito). Migrations vão direto para produção: avisar a responsável antes de aplicar; testes só com dados fictícios.

- **Hospedagem (29/09/2026):** o deploy saiu da conta pessoal e foi para a conta Vercel da **Latitudes** (`latitudes/latforms`, plano Hobby), ligada ao repositório **LatitudesViagens/LatForms**. URL de produção: **https://latforms-latitudes.vercel.app**. Mesmo banco, mesmas variáveis e mesmo `vercel.json` (`gru1` + cron diário); `CRON_SECRET` novo. O projeto antigo (`latforms.vercel.app`) segue no ar até a responsável decidir desativá-lo.

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

## 1. Objetivo

A equipe importa o CSV exportado do RD Station. O LatForms cria, para cada contato, uma **ficha online com a cara do PDF "Ficha de Cadastro Latitudes"**, já pré-preenchida. A consultora envia ao cliente um **link com token**. O cliente abre o link e **edita a ficha ali mesmo, no navegador** — sem baixar nada. Cada alteração é salva automaticamente e **aparece na hora** na tela da consultora, com o **campo editado destacado em amarelo**.

**Fluxo:**

```
RD Station ──CSV──▶ [Consultora logada] Importar CSV ▶ clientes no banco
                                   │
                                   ▼
                 Gerar ficha + link /f/<token> ▶ envia ao cliente
                                   │
          ┌────────────────────────┴───────────────────────────┐
          ▼                                                    ▼
  CLIENTE abre o link                               CONSULTORA abre a ficha
  Ficha no layout do PDF                            no painel (mesmo layout)
  (celular: modo lista)                                       ▲
          │                                                    │
          │ clica num campo ─▶ POST /presenca ─▶ Realtime ─────┤  contorno azul
          │                                     (broadcast)    │  "cliente editando"
          │ altera o valor  ─▶ PATCH /campos ─▶ banco ─────────┤
          │   (autosave)                        + Realtime     │  campo AMARELO
          ▼                                                    │  + histórico
  "Concluir ficha" ─▶ status concluída ─▶ Realtime ────────────┘
                                   │
                                   ▼
        Consultora revisa ▶ aprova ▶ baixa PDF final / exporta CSV
```

## 2. Custo: R$ 0

| Ferramenta | Uso | Plano | Custo |
|---|---|---|---|
| Vercel | Hospedagem Next.js + cron diário | Hobby | Grátis |
| Supabase | Postgres, Auth, **Realtime** | Free | Grátis |
| GitHub | Repositório privado + Actions (CI e backup) | Free | Grátis |
| Next.js, TypeScript, Tailwind, shadcn/ui | App | Open source | Grátis |
| pdf-lib, papaparse, zod | PDF final, CSV, validação | Open source | Grátis |
| Vitest, Playwright | Testes | Open source | Grátis |

**Simplificações em relação à versão 2:** não há mais upload de PDF pelo cliente, então o **Supabase Storage não é usado** (o limite de 1 GB deixa de ser problema) e o fluxo de URL assinada, leitura do PDF devolvido e validação de arquivo foram removidos.

> O Claude Code é ferramenta de desenvolvimento (plano pago do Claude). O sistema em si roda sem custo.

## 3. Pontos de atenção dos planos gratuitos

| Risco | Como o projeto contorna |
|---|---|
| **Vercel Hobby é "não comercial"** pelos termos | A Latitudes já usa Vercel: se houver um time Pro da empresa, criar o projeto nele. Se tudo for Hobby, **levar ao gestor**. |
| Supabase pausa após 1 semana sem atividade | Cron diário da Vercel (`/api/cron/manutencao`) faz uma consulta no banco. |
| Supabase Free não tem backup | GitHub Actions diário: `pg_dump` → `gpg` → artefato privado (30 dias). |
| Realtime Free: 200 conexões simultâneas e 2 milhões de mensagens/mês | Só as consultoras se conectam ao Realtime (o cliente não). Autosave com debounce e presença só na troca de campo → poucas mensagens por ficha. |
| Banco de 500 MB | Cada ficha + histórico ≈ 20–50 KB → dezenas de milhares de fichas. Limpeza de histórico antigo no cron. |
| Vercel Hobby: cron 1x/dia, 4 h de CPU/mês | Autosave é uma escrita leve (~20 ms); PDF só é gerado quando a consultora baixa. |
| E-mail do Supabase com limite baixo | Consultoras criadas manualmente no painel do Supabase. |

## 4. Decisões

| Tema | Decisão |
|---|---|
| Stack | Next.js 15 (App Router) + TypeScript + Supabase (Auth, Postgres, Realtime) |
| Região | Supabase `sa-east-1`; funções Vercel `gru1` |
| Login | Só equipe interna (consultoras), e-mail + senha, cadastro público desativado |
| Acesso do cliente | Sem login, link `/f/<token>` (32 bytes aleatórios, hash SHA-256, expira, revogável) |
| **Ficha do cliente** | Página web que reproduz o PDF: imagem de fundo do modelo + campos HTML posicionados nas coordenadas exatas dos campos do PDF (`assets/ficha-layout.json`). Em telas < 768 px, **modo lista** (mesmos campos empilhados por seção), porque o A4 fica ilegível no celular |
| **Salvamento** | Autosave por campo (debounce 800 ms e ao sair do campo) via `PATCH /api/f/[token]/campos`; indicador "Salvo ✓" |
| **Tempo real** | Supabase Realtime **Broadcast em canal privado** `ficha:<id>`. O servidor publica após gravar; só consultoras autenticadas assinam. O cliente nunca conecta ao Realtime |
| **Destaque** | Campo cujo valor atual ≠ valor original (vindo do CSV) fica **amarelo** na tela da consultora. Campo com o cliente dentro agora ganha **contorno azul** "editando agora". Alteração recém-chegada pisca por 2 s |
| PDF | Gerado sob demanda a partir dos dados atuais, só para download da equipe (e cópia opcional do cliente após concluir) |
| Ambientes | **1 projeto Supabase Free** (`LatForms`, org Latitudes Tech), que é o de produção. Decisão de 30/09/2026: não haverá banco separado de desenvolvimento/testes. |
| Domínio | `latforms-latitudes.vercel.app` (conta Vercel da Latitudes); domínios próprios da Latitudes via Azure |

## 5. Arquivos de apoio já gerados

| Arquivo | Onde colocar | O que é |
|---|---|---|
| `assets/ficha-bg.webp` (e `.png`) | `public/ficha/ficha-bg.webp` | Página do modelo renderizada a 144 dpi **sem os campos** e sem o parágrafo "salve o arquivo no seu computador" (esse espaço vira instruções em HTML) |
| `assets/ficha-layout.json` | `src/lib/ficha/ficha-layout.json` | Os 35 campos: chave, rótulo, tipo, nome no PDF, opções e **posição em % da página** (`left`, `top`, `width`, `height`). Já validado sobrepondo inputs na imagem |
| PDF modelo | `assets/templates/ficha-cadastro-2024.pdf` | Usado para gerar o PDF final |

## 6. Análise dos arquivos de origem

**CSV do RD Station:** UTF-8, primeira linha `sep=,`, 98 colunas, cabeçalhos com espaços extras, colunas quase duplicadas (`Estado`/`Estado:` etc.), datas em dois formatos, telefones múltiplos com `;`, sim/não em várias grafias, contatos quase vazios, coluna `ID` como chave. Detalhes e regras no SKILL.md.

**PDF modelo:** A4, 35 campos (texto, 6 dropdowns, 3 checkboxes). Campos sem fonte no CSV ficam para o cliente: Estado civil, Convênio médico, Condicionamento físico, Diabético(a)?, Distúrbio cardio-respiratório?. Obs.: o modelo tem um erro de digitação ("restições") que aparece na imagem de fundo — corrigir no Scribus se quiserem.

## 7. Modelo de dados (Supabase)

```sql
create table consultoras (
  id uuid primary key references auth.users on delete cascade,
  nome text not null,
  criado_em timestamptz default now()
);

create table importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo_nome text not null,
  total_linhas int not null,
  criados int not null default 0,
  atualizados int not null default 0,
  erros jsonb not null default '[]',
  importado_por uuid references consultoras(id),
  criado_em timestamptz default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  rd_id text unique not null,
  nome text not null,
  email text,
  dados_rd jsonb not null,
  dados_ficha jsonb not null,            -- mapeado do CSV
  ultima_importacao_id uuid references importacoes(id),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create type status_ficha as enum
  ('gerada','enviada','aberta','em_preenchimento','concluida','aprovada','cancelada');

create table fichas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  status status_ficha not null default 'gerada',
  dados_originais jsonb not null,        -- snapshot do CSV no momento da geração (base do amarelo)
  dados_atuais jsonb not null,           -- o que está na ficha agora
  campo_em_foco text,                    -- último campo em que o cliente clicou
  cliente_visto_em timestamptz,          -- último sinal do cliente (online se < 60 s)
  criado_por uuid references consultoras(id),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now(),
  concluida_em timestamptz,
  aprovada_em timestamptz
);

create table ficha_edicoes (             -- histórico campo a campo
  id bigserial primary key,
  ficha_id uuid not null references fichas(id) on delete cascade,
  campo text not null,
  valor_anterior jsonb,
  valor_novo jsonb,
  origem text not null default 'cliente',  -- 'cliente' | 'consultora'
  criado_em timestamptz default now()
);
create index on ficha_edicoes (ficha_id, criado_em desc);

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

create table auditoria (
  id bigserial primary key,
  ator text not null, acao text not null, ficha_id uuid,
  ip inet, user_agent text, criado_em timestamptz default now()
);

create table rate_limit (chave text primary key, janela_inicio timestamptz not null, contagem int not null);
-- função consumir_rate_limit(p_chave, p_limite, p_janela_seg) → boolean (ver SKILL.md)

-- grava 1 campo de forma atômica + histórico; ignora se o valor não mudou
create or replace function atualizar_campo(p_ficha uuid, p_campo text, p_valor jsonb, p_origem text)
returns jsonb language plpgsql security definer as $$
declare v_ant jsonb;
begin
  select dados_atuais -> p_campo into v_ant from fichas where id = p_ficha for update;
  if v_ant is not distinct from p_valor then return null; end if;
  update fichas set
    dados_atuais = jsonb_set(dados_atuais, array[p_campo], coalesce(p_valor,'null'::jsonb)),
    status = case when status in ('enviada','aberta') then 'em_preenchimento' else status end,
    atualizado_em = now()
  where id = p_ficha;
  insert into ficha_edicoes (ficha_id, campo, valor_anterior, valor_novo, origem)
  values (p_ficha, p_campo, v_ant, p_valor, p_origem);
  return jsonb_build_object('campo', p_campo, 'anterior', v_ant, 'novo', p_valor, 'em', now());
end $$;
```

**RLS:** habilitado em tudo; acesso só se `auth.uid()` está em `consultoras`. Rotas do cliente usam `service_role` só no servidor.

**Realtime:** nas configurações do Realtime, desligar acesso público a canais (só canais privados). Política em `realtime.messages`:
```sql
create policy "consultoras recebem broadcast das fichas"
on realtime.messages for select to authenticated
using ( realtime.topic() like 'ficha:%'
        and exists (select 1 from consultoras where id = auth.uid()) );
```

## 8. Rotas

**Painel das consultoras (login)**

| Rota | Função |
|---|---|
| `/login` | Login |
| `/admin` | Lista de fichas: status, % preenchido, nº de campos alterados, "cliente online agora" (atualiza em tempo real) |
| `/admin/importar` | CSV → prévia → confirmar |
| `/admin/fichas/[id]` | **Ficha ao vivo**: mesmo layout do PDF, campos amarelos, contorno azul no campo em foco, painel lateral "Atividade" com histórico (campo, antes → depois, horário), filtro "só alterados", botões gerar/revogar link, copiar mensagem, aprovar, reabrir, baixar PDF |

**API**

| Método | Endpoint | Auth |
|---|---|---|
| POST | `/api/importacoes` (`?dryRun=true`) | consultora |
| POST | `/api/fichas` `{ clienteId }` | consultora |
| POST / DELETE | `/api/fichas/[id]/link` | consultora |
| POST | `/api/fichas/[id]/aprovar` · `/reabrir` | consultora |
| GET | `/api/fichas/[id]/pdf` | consultora |
| GET | `/api/exportar?status=concluida` | consultora |
| GET | `/f/[token]` — ficha do cliente | token |
| PATCH | `/api/f/[token]/campos` `{ campo, valor }` — autosave | token |
| POST | `/api/f/[token]/presenca` `{ campo \| null }` — foco/heartbeat | token |
| POST | `/api/f/[token]/concluir` | token |
| GET | `/api/f/[token]/pdf` — cópia após concluir | token |
| GET | `/api/cron/manutencao` | `CRON_SECRET` |

**Eventos no canal `ficha:<id>`**

| Evento | Payload | Efeito na tela da consultora |
|---|---|---|
| `campo_atualizado` | `{ campo, anterior, novo, em }` | atualiza valor, recalcula amarelo, pisca 2 s, adiciona ao histórico |
| `presenca` | `{ campo \| null, em }` | contorno azul no campo; selo "Cliente online" |
| `status` | `{ status, em }` | selo de status (ex.: "Concluída pelo cliente") |

## 9. Segurança e LGPD

Agora os dados sensíveis (saúde, CPF, passaporte) **aparecem na tela** do link. Portanto:
- Token forte, só hash no banco, validade padrão 15 dias, revogável, 404 genérico.
- Rate limit: 60 escritas/min por token e 30 req/min por IP nas rotas `/f/*`.
- `PATCH /campos` aceita apenas chaves de `ficha-layout.json` e valida cada valor com zod (tipo, opções, tamanho máx. 500 caracteres; 1000 nos multilinha).
- Após `concluida`, a ficha fica somente leitura para o cliente até a consultora reabrir.
- `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` em `/f/*`.
- Payload do Realtime vai só por canal privado para consultoras autenticadas.
- Nunca logar valores de campos; auditoria registra só ações e IDs.
- Retenção: cron apaga histórico de fichas aprovadas há > 180 dias e tokens expirados há > 30 dias.
- Backup criptografado.

## 10. Fases e critérios de aceite

### Fase 0 — Setup (0,5 dia)
- Contas gratuitas, 2 projetos Supabase, Next.js + TS + Tailwind + shadcn/ui, Supabase CLI (sem Docker).
- Copiar `ficha-bg.webp`, `ficha-layout.json`, template e SKILL.md para os lugares da seção 5.
- ✅ `npm run dev` conectado ao `latforms-dev`.

### Fase 1 — Auth, banco e Realtime (1 dia)
- Migrations, RLS, funções `atualizar_campo` e `consumir_rate_limit`, política do Realtime, canais privados.
- ✅ Consultora logada assina `ficha:<id>`; usuário anônimo não consegue assinar.

### Fase 2 — Parser e mapeamento do CSV (2 dias)
- Conforme SKILL.md, com testes.
- ✅ 100% das regras de mapeamento testadas.

### Fase 3 — Importação e geração de fichas/links (1 dia)
- ✅ Reimportar não duplica; ficha nova copia `dados_ficha` em `dados_originais` e `dados_atuais`.

### Fase 4 — Componente `<FichaDocumento>` (2 dias) — núcleo visual
- Renderiza o fundo + campos a partir de `ficha-layout.json`, escala com a largura (fonte proporcional).
- Props: `modo: 'cliente' | 'consultora'`, `valores`, `originais`, `campoEmFoco`, `onChange`, `onFocus`.
- `<FichaLista>` para celular, agrupado por seção, mesmas props.
- Máscaras: CPF, CEP, telefone, datas (DD/MM/AAAA).
- ✅ Em 1280 px os campos ficam exatamente sobre as caixas do modelo; em 390 px aparece o modo lista; acessível por teclado (Tab segue a ordem da ficha).

### Fase 5 — Link do cliente com autosave (1,5 dia)
- `/f/[token]`: saudação, instruções curtas, ficha, indicador "Salvando… / Salvo ✓ / Sem conexão — tentaremos de novo", botão "Concluir ficha".
- Fila de salvamento no cliente: debounce 800 ms, envio ao sair do campo, retry com backoff se offline, aviso ao fechar a aba com pendências.
- Presença: `POST /presenca` ao focar/desfocar (throttle 1 s) e heartbeat a cada 30 s com a aba visível.
- ✅ Editar um campo, recarregar a página e o valor continua lá.

### Fase 6 — Painel ao vivo da consultora (2 dias)
- `/admin/fichas/[id]` com `<FichaDocumento modo="consultora">` somente leitura.
- Assinatura do canal; ao reconectar ou voltar à aba, recarrega o estado do banco (nada se perde se uma mensagem falhar).
- Amarelo = `valorAtual ≠ valorOriginal`; tooltip "Antes: … · Alterado às 14:32"; contorno azul + etiqueta "Cliente editando" no campo em foco; selo "Cliente online" (sinal < 60 s); piscar 2 s em mudanças novas; painel "Atividade"; filtro "só alterados"; legenda das cores.
- `/admin` atualiza status e contadores em tempo real.
- ✅ Com duas janelas (cliente e consultora), a alteração aparece em amarelo na consultora em menos de 2 s; o foco do cliente aparece em azul.

### Fase 7 — Conclusão, PDF final e exportação (1 dia)
- Concluir (cliente), aprovar/reabrir (consultora), PDF final com `pdf-lib` a partir de `dados_atuais`, exportação CSV.
- ✅ PDF final abre corretamente com todos os valores e acentos.

### Fase 8 — Operação gratuita e deploy (1 dia)
- `vercel.json` (regions + cron), `backup.yml`, `ci.yml`, deploy, README (restaurar backup, reativar Supabase).
- ✅ Cron e backup funcionando; E2E completo (Playwright com 2 contextos: cliente e consultora).

**Estimativa total:** ~12 dias úteis.

## 11. Estrutura de pastas

```
.
├── .claude/skills/ficha-cadastro-latitudes/SKILL.md
├── .github/workflows/{ci.yml,backup.yml}
├── assets/templates/ficha-cadastro-2024.pdf
├── public/ficha/ficha-bg.webp
├── vercel.json
├── src/
│   ├── app/
│   │   ├── login/page.tsx
│   │   ├── admin/{page.tsx,importar/page.tsx,fichas/[id]/page.tsx}
│   │   ├── f/[token]/page.tsx
│   │   └── api/
│   │       ├── importacoes/route.ts
│   │       ├── fichas/route.ts
│   │       ├── fichas/[id]/{link,aprovar,reabrir,pdf}/route.ts
│   │       ├── exportar/route.ts
│   │       ├── f/[token]/{campos,presenca,concluir,pdf}/route.ts
│   │       └── cron/manutencao/route.ts
│   ├── components/ficha/{FichaDocumento,FichaLista,CampoFicha,PainelAtividade,LegendaCores}.tsx
│   ├── hooks/{useAutosave,usePresenca,useFichaAoVivo}.ts
│   ├── lib/
│   │   ├── supabase/{server,client,admin}.ts
│   │   ├── realtime/broadcast.ts
│   │   ├── rd/parse-csv.ts
│   │   ├── ficha/{ficha-layout.json,layout.ts,schema,mapping,normalizers,diff}.ts
│   │   ├── ficha/pdf/fill.ts
│   │   ├── tokens.ts, rate-limit.ts, audit.ts
│   └── middleware.ts
├── supabase/migrations/
└── tests/{unit,e2e,fixtures}/
```

## 12. Pontos para confirmar com o responsável

1. **Verificação extra no link:** como os dados de saúde agora aparecem na tela, vale pedir a data de nascimento do cliente antes de abrir a ficha? (Recomendado; custo zero e ~0,5 dia.)
2. A consultora também poderá editar a ficha pelo painel? (O modelo já suporta `origem = 'consultora'`.)
3. Um campo alterado e depois revertido ao valor original deve continuar amarelo? (Proposta: não; o histórico registra a ida e a volta.)
4. Campos obrigatórios para liberar "Concluir ficha".
5. Uso da Vercel Hobby vs. time Pro da empresa.
6. Validade do link e retenção dos dados (LGPD).

## 13. Evoluções futuras
- Integração com a API do RD Station.
- Envio do link por e-mail/WhatsApp direto do painel.
- Notificação para a consultora quando o cliente concluir.
- Múltiplos modelos de ficha (o `ficha-layout.json` já isola o template).
