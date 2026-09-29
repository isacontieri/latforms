@AGENTS.md

# LatForms

Motor de fichas da Latitudes (v3): importa contatos do RD Station (CSV) e cria, para cada um, uma **ficha online com a cara do PDF "Ficha de Cadastro Latitudes"** (71 campos, `lib/ficha/campos.ts` + `lib/ficha/ficha-layout.json`), já pré-preenchida. O cliente abre o **link com token** e **preenche ali mesmo** (autosave por campo); a consultora **acompanha em tempo real** (Supabase Realtime): campo alterado em amarelo, campo em foco com contorno azul. Só as consultoras fazem login. Plano em `PLANO_IMPLEMENTACAO.md`; regras de domínio na skill `ficha-cadastro-latitudes` (a seção "Decisões desta implementação" no topo prevalece).

Stack: Next.js 16 (App Router, `src/proxy.ts`) + TypeScript + Supabase (Auth, Postgres, **Realtime**) + `pdf-lib` + `papaparse` + `zod` + Tailwind. Testes: Vitest e Playwright. Domínio em português (`cliente`, `ficha`, `consultora`, `DadosFicha`), termos técnicos em inglês.

Hospedagem: **Vercel Hobby + Supabase Free + GitHub Free. O projeto tem custo zero e precisa continuar assim.**

## Restrições de custo zero (obrigatórias)

- **Nenhum serviço, SDK ou dependência paga** (nem trial): nada de Upstash, Resend, Pusher, Ably, Liveblocks, Sentry pago, Vercel KV/Blob/Postgres, Password Protection. Tempo real é **só Supabase Realtime**. Se algo parecer exigir serviço pago, parar e perguntar.
- **Supabase Storage não é usado** (não há upload). PDF final é gerado sob demanda de `fichas.dados_atuais` + fontes/logo de `assets/`.
- **CSV importado não é guardado.** O navegador lê o arquivo e envia lotes de até 200 linhas em JSON.
- Realtime Free (200 conexões, 2 M mensagens/mês): **só consultoras conectam**; broadcast só após gravação real; presença só na troca de campo + heartbeat de 30 s.
- **Rate limit** com a função Postgres `consumir_rate_limit`. **Cron** 1x/dia em `/api/cron/manutencao`.
- **Sem Docker.** Dev no projeto Supabase Free `latforms-dev` (`supabase db push`). Nunca aplicar em `latforms-prod` sem pedido explícito. No máximo 2 projetos.
- Funções em `gru1` (`vercel.json`), Supabase em `sa-east-1`. Chaves novas: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`.

## Regras invioláveis

1. **Nunca salvar o token puro.** Só `sha256(token)`; o token aparece uma única vez.
2. **`SUPABASE_SECRET_KEY` só no servidor** (`lib/supabase/admin.ts`, `import 'server-only'`).
3. **O cliente nunca se conecta ao Supabase** (nem publishable key, nem Realtime). Tudo do cliente passa por `/api/f/[token]/*`.
4. **Realtime só em canal privado** (`ficha:<id>`, `fichas:lista`) com política em `realtime.messages` restrita a consultoras. Nunca canal público nem Postgres Changes.
5. **O banco é a fonte da verdade:** Realtime só avisa; ao montar, reconectar ou voltar à aba, o painel recarrega do banco.
6. Escrita de campo **sempre** via RPC `atualizar_campo` (atômica + histórico); `PATCH /campos` aceita só chaves do `ficha-layout.json`, valor validado com zod.
7. **Autorização não depende só do `proxy.ts`:** toda página/rota de consultora chama `verificarConsultora()`/`exigirConsultora()`. O proxy não intercepta `/f/*`, `/api/f/*`, `/api/cron/*`. As rotas de equipe (`/api/equipe/*`: convite, nova senha, remover, tornar admin) exigem `exigirAdmin()` (`consultoras.admin`); o perfil de administrador não muda nada nas fichas.
8. **Nunca logar valores de campos** nem conteúdo do CSV/`dados_rd` (dados de saúde = sensível LGPD). Só IDs e nomes de campo.
9. **Não inferir dados de saúde** que o cliente não informou.
10. Token inválido, expirado, revogado ou de ficha cancelada → **404 genérico**.
11. `/f/*` e `/api/f/*`: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, rate limit.
12. Funções SQL `security definer` com `set search_path = public`; as só do servidor com `revoke execute … from public, anon, authenticated`.
13. PDF final nunca achatado (`form.flatten()` proibido). Toda ação relevante grava em `auditoria` (`lib/audit.ts`).

## Convenções

- Route handlers retornam `{ ok: true, data } | { ok: false, erro }`.
- Mensagens ao usuário em português, tom acolhedor (o cliente é viajante, não técnico); logs técnicos podem ser em inglês.
- Conventional Commits. Antes de concluir qualquer tarefa: `npm run check` (lint + typecheck + testes).
