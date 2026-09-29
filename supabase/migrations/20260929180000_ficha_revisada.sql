-- "Marcar como revisado": a consultora guarda uma foto dos dados no momento da revisão.
-- Amarelo passa a ser "atual ≠ revisado" (ou "atual ≠ original do RD" se nunca foi revisada).

alter table public.fichas
  add column dados_revisados jsonb,
  add column revisado_em timestamptz,
  add column revisado_por uuid references public.consultoras(id) on delete set null;

-- Atômico: a foto é exatamente o dados_atuais daquele instante (sem corrida com o autosave).
create function public.marcar_revisado(p_ficha uuid, p_consultora uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_em timestamptz := now();
begin
  update public.fichas
     set dados_revisados = dados_atuais, revisado_em = v_em, revisado_por = p_consultora
   where id = p_ficha and status <> 'cancelada';
  if not found then return null; end if;
  return v_em;
end $$;

revoke execute on function public.marcar_revisado(uuid, uuid) from public, anon, authenticated;
grant execute on function public.marcar_revisado(uuid, uuid) to service_role;
