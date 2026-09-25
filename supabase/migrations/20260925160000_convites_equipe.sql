-- Cadastro de funcionários pelo próprio aplicativo, sem e-mail (o SMTP padrão do Supabase Free não entrega
-- para qualquer endereço): um funcionário gera um link de uso único e envia pelo canal que a equipe já usa.

-- e-mail do funcionário para listar a equipe sem consultar o Auth a cada tela
alter table public.funcionarios add column email text;
update public.funcionarios f set email = u.email from auth.users u where u.id = f.id;

create type public.tipo_convite as enum (
  'convite',     -- pessoa nova: define nome e senha e vira funcionária
  'nova_senha'   -- funcionário existente: define uma senha nova
);

create table public.convites_equipe (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_convite not null,
  token_hash text unique not null,        -- sha256 do token; o token puro aparece só uma vez para quem gerou
  email text not null,
  nome text,                              -- sugestão de nome (convite)
  usuario_id uuid references auth.users on delete cascade,  -- nova_senha
  criado_por uuid references public.funcionarios(id) on delete set null,
  expira_em timestamptz not null,
  usado_em timestamptz,
  revogado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- no máximo um link pendente por e-mail e tipo (gerar outro revoga o anterior)
create unique index convites_um_pendente on public.convites_equipe (lower(email), tipo)
  where usado_em is null and revogado_em is null;

-- só o servidor (secret key) acessa: nenhuma política para anon/authenticated
alter table public.convites_equipe enable row level security;
revoke all on public.convites_equipe from anon, authenticated;
