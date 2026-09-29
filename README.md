# LatForms

Ficha de Cadastro da Latitudes preenchida pelo cliente direto no navegador, acompanhada ao vivo pela consultora.

1. A consultora importa o CSV exportado do RD Station (`/admin/importar`). O navegador lê o arquivo e envia lotes; nada do CSV é guardado.
2. Para cada cliente, gera a ficha (71 campos, pré-preenchida com os dados do RD) e um **link com token** (`/f/<token>`, 15 dias).
3. O cliente abre o link e preenche a ficha numa página que reproduz o PDF. Cada campo é salvo sozinho.
4. A consultora acompanha em `/admin/fichas/<id>`: campo alterado fica **amarelo**, o campo em que o cliente está agora fica com **contorno azul**.
5. O cliente clica em "Concluir ficha"; a consultora aprova (ou reabre), baixa o PDF final (preenchível) ou exporta o CSV.

Custo zero: Vercel Hobby + Supabase Free + GitHub Free. Regras do projeto em [CLAUDE.md](CLAUDE.md), plano em [PLANO_IMPLEMENTACAO.md](PLANO_IMPLEMENTACAO.md), regras de domínio na skill [ficha-cadastro-latitudes](.claude/skills/ficha-cadastro-latitudes/SKILL.md).

## Rodar localmente

Requisitos: Node 24, [Supabase CLI](https://supabase.com/docs/guides/cli) (sem Docker; usamos o projeto `latforms-dev` na nuvem).

```bash
npm install
cp .env.example .env.local   # preencher com as chaves do latforms-dev
npm run dev                  # http://localhost:3000
```

A primeira consultora é cadastrada pelo painel do Supabase (Authentication → Add user) e na tabela `consultoras`; as próximas são convidadas por `/admin/equipe`.

| Comando | O que faz |
|---|---|
| `npm run check` | lint + typecheck + testes unitários (rodar antes de todo commit) |
| `npm run e2e` | E2E com Playwright contra `http://localhost:3000` (ou `APP=<url>`), usando o banco do `.env.local` com dados fictícios que são apagados no fim. **Nunca apontar para produção.** |
| `npm run ficha:layout` | regenera `src/lib/ficha/ficha-layout.json` e os fundos `public/ficha/pagina-N.webp` a partir do gerador do PDF (precisa de `PYTHON` com `pymupdf` e `pillow`) |
| `npm run db:types` | regenera os tipos do banco (`supabase link` antes) |

## Banco (Supabase)

Migrations em `supabase/migrations`. Para aplicar:

```bash
supabase link --project-ref <ref>   # latforms-dev ou latforms-prod
supabase db push
```

No painel do Supabase, em **Realtime → Settings**, deixar **"Allow public access" desligado**: assim só canais privados funcionam, e a política em `realtime.messages` só deixa consultoras receberem os eventos.

## Deploy (Vercel)

Projeto **`latitudes/latforms`** na conta Vercel da Latitudes (plano Hobby), ligado ao repositório **LatitudesViagens/LatForms**: push na `main` faz o deploy de produção (região `gru1`).

- Produção: **https://latforms-latitudes.vercel.app** (também responde em `latforms-pink.vercel.app`).
- Proteção de deploy: padrão da Vercel (gratuita). O domínio de produção é público; as URLs de cada deploy e as prévias pedem login na Vercel.
- Deploy manual: `vercel --prod` (com `vercel whoami` = `latitudesviagens`).
- O projeto antigo (`contieri/latforms`, `latforms.vercel.app`, conta pessoal) continua no ar até ser desativado.

Variáveis de ambiente (Production e Preview):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publishable (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | chave secret (`sb_secret_…`), marcada como *Sensitive* |
| `CRON_SECRET` | segredo aleatório (Sensitive); a Vercel manda no cron e ele também assina o cookie da verificação |
| `APP_URL` | URL pública: `https://latforms-latitudes.vercel.app` |
| `TOKEN_TTL_DIAS` | validade do link do cliente (padrão 15) |
| `EXIGIR_VERIFICACAO` | `true` para pedir a data de nascimento antes de mostrar a ficha (padrão desligado) |

No Supabase: Authentication → URL Configuration → Site URL = `APP_URL` e `APP_URL/**` nas Redirect URLs.

## Manutenção diária (cron)

`vercel.json` agenda `GET /api/cron/manutencao` 1x por dia (06:00 em Brasília). Ele consulta o banco (evita que o Supabase Free pause por inatividade), apaga contadores de rate limit com mais de 1 dia, links expirados ou revogados há mais de 30 dias e o histórico de edições de fichas aprovadas há mais de 180 dias, e registra na auditoria.

Para rodar na mão: `curl -H "Authorization: Bearer $CRON_SECRET" https://latforms-latitudes.vercel.app/api/cron/manutencao` (sem o segredo responde 404, de propósito).


### Se o Supabase pausar

Se o projeto ficar pausado (o cron falhou por mais de 7 dias), entrar no painel do Supabase, abrir o projeto e clicar em **Restore project**. Os dados continuam lá; leva alguns minutos. Depois, rodar o cron na mão para conferir.

## Backup

`.github/workflows/backup.yml` roda todo dia às 03:00 (Brasília): `pg_dump` dos schemas `public` e `auth` → criptografado com `gpg` (AES256) → artefato privado do GitHub Actions por 30 dias.

Segredos do repositório (Settings → Secrets and variables → Actions):

- `SUPABASE_DB_URL`: Supabase → Connect → **Session pooler** (porta 5432), com a senha do banco.
- `BACKUP_PASSPHRASE`: frase longa e aleatória. **Guardar fora do GitHub** (gerenciador de senhas): sem ela o backup não abre.

Para testar: Actions → "Backup do banco" → Run workflow.

### Restaurar um backup

1. Baixar o artefato em Actions → execução → Artifacts (vem num `.zip`).
2. Descriptografar: `gpg --batch --pinentry-mode loopback --passphrase "<BACKUP_PASSPHRASE>" -o latforms.dump -d latforms-AAAA-MM-DD.dump.gpg`
3. Restaurar num projeto Supabase (de preferência um novo, para conferir antes):
   `pg_restore --no-owner --no-privileges --clean --if-exists -d "<SUPABASE_DB_URL do destino>" latforms.dump`
4. Apagar o `.dump` descriptografado depois (contém dados pessoais e de saúde).

## Repositórios

O código fica em dois repositórios privados, sempre iguais:

- **github.com/isacontieri/latforms**: origem (autoria). O backup diário roda nele.
- **github.com/LatitudesViagens/LatForms**: repositório da empresa. A Vercel da Latitudes (`latforms-latitudes.vercel.app`) está ligada a ele, e ele também é usado para a Azure com os domínios da Latitudes.

O `origin` local envia para os dois de uma vez (`git push` atualiza ambos):

```bash
git remote set-url --add --push origin https://github.com/isacontieri/latforms.git
git remote set-url --add --push origin https://github.com/LatitudesViagens/LatForms.git
git remote -v   # 1 fetch (isacontieri) e 2 push
```

## CI

`.github/workflows/ci.yml` roda lint, typecheck e testes unitários em todo push na `main`/`v3` e em pull requests.
