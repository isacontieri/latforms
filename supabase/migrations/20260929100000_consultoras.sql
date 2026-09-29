-- v3: a equipe interna passa a se chamar "consultoras" (tabela e função usadas pelas políticas de RLS).
-- As chaves estrangeiras (importacoes, fichas, convites_equipe) seguem valendo depois do rename.

alter table public.funcionarios rename to consultoras;
alter function public.is_funcionario() rename to is_consultora;

create or replace function public.is_consultora() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.consultoras where id = auth.uid())
$$;
revoke execute on function public.is_consultora() from public, anon;
grant execute on function public.is_consultora() to authenticated, service_role;

alter policy funcionarios_select on public.consultoras rename to consultoras_select;
alter policy importacoes_funcionario on public.importacoes rename to importacoes_consultora;
alter policy clientes_funcionario on public.clientes rename to clientes_consultora;
alter policy fichas_funcionario on public.fichas rename to fichas_consultora;
