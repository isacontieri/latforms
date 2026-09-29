-- Administradores da equipe: só eles convidam, geram link de nova senha, removem acesso e
-- definem quem é administrador. Não muda nada nas fichas.
-- consultoras não tem política de UPDATE: ninguém se promove pelo navegador; só o servidor (secret key).

alter table public.consultoras add column admin boolean not null default false;

-- primeira administradora: Isabelle
update public.consultoras set admin = true where lower(email) = 'isabelle@latitudes.com.br';

-- Define/retira administrador de forma atômica, sem nunca deixar a equipe sem nenhum.
create function public.definir_admin(p_alvo uuid, p_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.consultoras for update; -- trava a equipe durante a checagem
  if not exists (select 1 from public.consultoras where id = p_alvo) then
    raise exception 'consultora_inexistente';
  end if;
  if not p_admin and not exists (select 1 from public.consultoras where admin and id <> p_alvo) then
    raise exception 'ultimo_admin';
  end if;
  update public.consultoras set admin = p_admin where id = p_alvo;
end $$;

revoke execute on function public.definir_admin(uuid, boolean) from public, anon, authenticated;
grant execute on function public.definir_admin(uuid, boolean) to service_role;
