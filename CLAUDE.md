@AGENTS.md

# LatForms

Motor de fichas da Latitudes: transforma contatos exportados do RD Station (CSV) em **PDFs preenchíveis** da Ficha de Cadastro (gerados pelo sistema a partir de `lib/ficha/campos.ts`, 71 campos), entregues ao cliente por **link com token**. Só os funcionários fazem login. Plano completo em `PLANO_IMPLEMENTACAO.md`; regras de domínio (CSV, mapeamento, PDF, tokens) na skill `ficha-cadastro-latitudes`.

Stack: Next.js 16 (App Router, `proxy.ts`) + TypeScript + Supabase (Auth, Postgres, Storage) + `pdf-lib` + `papaparse` + `zod` + Tailwind/shadcn. Testes: Vitest e Playwright. Nomes de domínio em português (`cliente`, `ficha`, `DadosFicha`), termos técnicos em inglês.

Hospedagem: **Vercel Hobby + Supabase Free + GitHub Free. O projeto tem custo zero e precisa continuar assim.**

## Restrições de custo zero (obrigatórias)

- **Não adicionar nenhum serviço, SDK ou dependência paga** (nem com free trial): nada de Upstash, Resend, Sentry pago, Vercel KV/Blob/Postgres, integrações com mensageiros etc. Só bibliotecas open source e os planos gratuitos acima. Se algo parecer exigir um serviço pago, parar e perguntar.
- **Não guardar PDFs gerados** no Storage (limite de 1 GB). O PDF é gerado sob demanda a partir de `fichas.dados_snapshot` + fontes/logo de `assets/`.
- **Não guardar o CSV importado.** O navegador lê o arquivo e envia lotes de até 200 linhas em JSON; o servidor processa e descarta.
- **Nenhum arquivo passa pelo corpo de uma função Vercel** (limite de 4,5 MB). O PDF do cliente vai direto para o Supabase Storage por URL assinada.
- **Rate limit** com a função Postgres `consumir_rate_limit`, não com serviço externo.
- **Cron:** a Vercel Hobby só roda cron 1x por dia. Tudo que é periódico fica em `/api/cron/manutencao`.
- **Sem Docker.** O dev usa o projeto Supabase Free `latforms-dev`; migrations com `supabase link` + `supabase db push`.
- No máximo 2 projetos Supabase (`latforms-dev`, `latforms-prod`).
- Funções em `gru1` (`vercel.json`), Supabase em `sa-east-1`.
- Hospedagem só na Vercel, sem recursos pagos (KV, Blob, Postgres, Edge Config pago, Password Protection).
- Chaves do Supabase: usar as novas **publishable** e **secret** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`), não as legadas `anon`/`service_role`.

## Regras invioláveis

1. **Nunca achatar o PDF** (`form.flatten()` é proibido). O cliente precisa editar os campos.
2. **Nunca salvar o token puro.** Salvar só `sha256(token)`; o token aparece uma única vez na resposta de criação.
3. **Nunca expor `SUPABASE_SECRET_KEY` no client.** Só em route handlers / server actions (`lib/supabase/admin.ts` com `import 'server-only'`).
4. **Autorização não depende só do `proxy.ts`.** Todo layout de `/admin` e todo route handler de funcionário chamam `exigirFuncionario()` (`lib/auth.ts`). O `proxy.ts` não intercepta `/f/*`, `/api/f/*` nem `/api/cron/*`.
5. **Nunca logar** conteúdo do CSV, de `dados_rd`, `dados_ficha` ou do PDF (dados de saúde = dado sensível LGPD). Logar apenas IDs.
6. **Não inferir dados de saúde** que o cliente não informou. Campo sem fonte clara fica em branco.
7. Token inválido, expirado, revogado ou de ficha cancelada → sempre **404 genérico**.
8. Todas as rotas `/f/*` e `/api/f/*`: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, rate limit por IP.
9. Funções SQL `security definer` sempre com `set search_path = public` e, se forem só do servidor, `revoke execute ... from public, anon, authenticated`.
10. Toda ação relevante grava em `auditoria` (`lib/audit.ts`).

## Convenções

- Server actions/route handlers retornam `{ ok: true, data } | { ok: false, erro }`.
- Mensagens para o usuário em português; logs e erros técnicos podem ser em inglês.
- Commits no padrão Conventional Commits (`feat:`, `fix:`, `test:`...).
- Antes de concluir qualquer tarefa: `npm run check` (lint + typecheck + testes).
