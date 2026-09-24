-- LatForms — schema inicial (Fase 1)
-- Regras: PLANO_IMPLEMENTACAO.md §6 e §9; skill ficha-cadastro-latitudes §8.
-- Acesso: funcionários (authenticated + registro em funcionarios) via RLS; clientes nunca acessam o banco
-- diretamente — as rotas /f/* usam a secret key só no servidor.

-- ─── Funcionários ───────────────────────────────────────────────────────────

create table public.funcionarios (
  id uuid primary key references auth.users on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now()
);

-- usado pelas políticas de RLS (security definer evita recursão ao consultar funcionarios)
create function public.is_funcionario() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.funcionarios where id = auth.uid())
$$;

-- ─── Importação e clientes ──────────────────────────────────────────────────

create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo_nome text not null,            -- só o nome; o CSV não é guardado
  total_linhas int not null,
  criados int not null default 0,
  atualizados int not null default 0,
  erros jsonb not null default '[]',
  importado_por uuid references public.funcionarios(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  rd_id text unique not null,
  nome text not null,
  email text,
  dados_rd jsonb not null,               -- { campos, extras, original } — todas as colunas do RD
  dados_ficha jsonb not null,            -- os 35 campos mapeados para a ficha
  ultima_importacao_id uuid references public.importacoes(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create function public.tocar_atualizado_em() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger clientes_atualizado_em before update on public.clientes
for each row execute function public.tocar_atualizado_em();

-- ─── Fichas e links ─────────────────────────────────────────────────────────

create type public.status_ficha as enum (
  'gerada',               -- ficha criada, sem link
  'enviada',              -- link gerado
  'aberta',               -- cliente baixou o PDF
  'respondida',           -- PDF devolvido e validado
  'correcao_solicitada',  -- funcionário pediu correção; cliente pode reenviar
  'aprovada',
  'cancelada'
);

create table public.fichas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  versao int not null default 1,
  status public.status_ficha not null default 'gerada',
  dados_snapshot jsonb not null,         -- dados_ficha no momento da geração (o PDF é regerado daqui)
  pdf_respondido_path text,              -- bucket fichas-respondidas
  dados_respondidos jsonb,
  motivo_correcao text,                  -- curto e sem dado sensível (aparece na página do cliente)
  criado_por uuid references public.funcionarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  respondida_em timestamptz,
  aprovada_em timestamptz
);
create index fichas_cliente_id on public.fichas (cliente_id);
create index fichas_status on public.fichas (status);

create table public.tokens_acesso (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas(id) on delete cascade,
  token_hash text unique not null,       -- sha256 do token; o token puro nunca é salvo
  expira_em timestamptz not null,
  revogado_em timestamptz,
  usos int not null default 0,
  ultimo_acesso_em timestamptz,
  criado_em timestamptz not null default now()
);
-- no máximo 1 token ativo por ficha
create unique index tokens_um_ativo on public.tokens_acesso (ficha_id) where revogado_em is null;

-- ─── Auditoria e rate limit ─────────────────────────────────────────────────

create table public.auditoria (
  id bigserial primary key,
  ator text not null,                    -- 'funcionario:<uuid>', 'cliente:<ficha_id>', 'cron'
  acao text not null,
  ficha_id uuid,
  ip inet,
  user_agent text,
  criado_em timestamptz not null default now()
);
create index auditoria_ficha_id on public.auditoria (ficha_id);
create index auditoria_criado_em on public.auditoria (criado_em);

create table public.rate_limit (
  chave text primary key,                -- ex.: 'f:<ip>'
  janela_inicio timestamptz not null,
  contagem int not null
);

-- ─── Funções usadas só pelo servidor (secret key) ───────────────────────────

create function public.consumir_rate_limit(p_chave text, p_limite int, p_janela_seg int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  insert into public.rate_limit as r (chave, janela_inicio, contagem)
  values (p_chave, now(), 1)
  on conflict (chave) do update set
    contagem      = case when r.janela_inicio < now() - make_interval(secs => p_janela_seg) then 1 else r.contagem + 1 end,
    janela_inicio = case when r.janela_inicio < now() - make_interval(secs => p_janela_seg) then now() else r.janela_inicio end
  returning contagem <= p_limite into v_ok;
  return v_ok;
end $$;

-- Revoga o link ativo e cria o novo numa transação; 'gerada' → 'enviada'.
create function public.gerar_link(p_ficha_id uuid, p_token_hash text, p_expira_em timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.tokens_acesso set revogado_em = now()
  where ficha_id = p_ficha_id and revogado_em is null;

  insert into public.tokens_acesso (ficha_id, token_hash, expira_em)
  values (p_ficha_id, p_token_hash, p_expira_em)
  returning id into v_id;

  update public.fichas set status = 'enviada'
  where id = p_ficha_id and status = 'gerada';

  return v_id;
end $$;

-- Funções do schema public ficam expostas em /rest/v1/rpc: só o servidor chama estas.
revoke execute on function public.consumir_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function public.gerar_link(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.tocar_atualizado_em() from public, anon, authenticated;
grant execute on function public.consumir_rate_limit(text, int, int) to service_role;
grant execute on function public.gerar_link(uuid, text, timestamptz) to service_role;

-- is_funcionario é chamada pelas políticas de RLS de quem está logado
revoke execute on function public.is_funcionario() from public, anon;
grant execute on function public.is_funcionario() to authenticated, service_role;

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Anônimo não acessa nenhuma tabela. Funcionário acessa via is_funcionario().
-- A secret key (service_role) ignora RLS e é usada só no servidor.

alter table public.funcionarios        enable row level security;
alter table public.importacoes   enable row level security;
alter table public.clientes      enable row level security;
alter table public.fichas        enable row level security;
alter table public.tokens_acesso enable row level security;
alter table public.auditoria     enable row level security;
alter table public.rate_limit    enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- funcionarios: funcionário vê a equipe; inclusão/remoção só pelo painel ou SQL
create policy funcionarios_select on public.funcionarios for select to authenticated using (public.is_funcionario());

create policy importacoes_funcionario on public.importacoes for all to authenticated
  using (public.is_funcionario()) with check (public.is_funcionario());
create policy clientes_funcionario on public.clientes for all to authenticated
  using (public.is_funcionario()) with check (public.is_funcionario());
create policy fichas_funcionario on public.fichas for all to authenticated
  using (public.is_funcionario()) with check (public.is_funcionario());

-- tokens: funcionário consulta e revoga; criação só por gerar_link (servidor)
create policy tokens_select on public.tokens_acesso for select to authenticated using (public.is_funcionario());
create policy tokens_update on public.tokens_acesso for update to authenticated
  using (public.is_funcionario()) with check (public.is_funcionario());

-- auditoria: só leitura para funcionário; gravação pelo servidor
create policy auditoria_select on public.auditoria for select to authenticated using (public.is_funcionario());

-- rate_limit: sem políticas (só a secret key acessa)

-- ─── Storage ────────────────────────────────────────────────────────────────
-- PDFs devolvidos pelos clientes. Privado, 5 MB, só PDF. Sem políticas: o upload usa URL
-- assinada criada pelo servidor e a leitura passa pelas rotas do servidor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fichas-respondidas', 'fichas-respondidas', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;
