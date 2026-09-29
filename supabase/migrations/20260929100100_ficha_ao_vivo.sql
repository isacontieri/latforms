-- v3: o cliente preenche a ficha no link (autosave por campo) e a consultora acompanha ao vivo.
-- Sai o fluxo de PDF devolvido (dados_respondidos, pdf_respondido_path); entram dados_originais/dados_atuais
-- e o histórico campo a campo (ficha_edicoes).

-- ─── Status novo ────────────────────────────────────────────────────────────
drop index if exists public.fichas_uma_ativa_por_cliente;
drop index if exists public.fichas_status;

alter type public.status_ficha rename to status_ficha_v2;
create type public.status_ficha as enum
  ('gerada', 'enviada', 'aberta', 'em_preenchimento', 'concluida', 'aprovada', 'cancelada');

alter table public.fichas alter column status drop default;
alter table public.fichas alter column status type public.status_ficha using (
  case status::text
    when 'respondida' then 'concluida'
    when 'correcao_solicitada' then 'em_preenchimento'
    else status::text
  end
)::public.status_ficha;
alter table public.fichas alter column status set default 'gerada';
drop type public.status_ficha_v2;

-- ─── Dados originais × atuais ───────────────────────────────────────────────
alter table public.fichas
  add column dados_originais jsonb,           -- o que veio do RD (base do amarelo no painel)
  add column dados_atuais jsonb,              -- o que está na ficha agora
  add column campo_em_foco text,              -- último campo em que o cliente clicou
  add column cliente_visto_em timestamptz,    -- último sinal do navegador do cliente (online se < 60 s)
  add column atualizado_em timestamptz not null default now(),
  add column concluida_em timestamptz;

-- fichas de teste da v2: a versão devolvida pelo cliente vira o estado atual
update public.fichas set
  dados_originais = dados_snapshot,
  dados_atuais    = coalesce(dados_respondidos, dados_snapshot),
  concluida_em    = respondida_em;

alter table public.fichas
  alter column dados_originais set not null,
  alter column dados_atuais set not null,
  drop column dados_snapshot,
  drop column dados_respondidos,
  drop column pdf_respondido_path,
  drop column motivo_correcao,
  drop column respondida_em,
  drop column snapshot_atualizado_em,
  drop column versao;

create unique index fichas_uma_ativa_por_cliente on public.fichas (cliente_id) where status <> 'cancelada';
create index fichas_status on public.fichas (status);

create trigger fichas_atualizado_em before update on public.fichas
for each row execute function public.tocar_atualizado_em();

-- ─── Histórico campo a campo ────────────────────────────────────────────────
create table public.ficha_edicoes (
  id bigserial primary key,
  ficha_id uuid not null references public.fichas(id) on delete cascade,
  campo text not null,
  valor_anterior jsonb,
  valor_novo jsonb,
  -- TODO(v3): hoje só o cliente edita; 'consultora' fica preparado para a edição pelo painel
  origem text not null default 'cliente' check (origem in ('cliente', 'consultora')),
  criado_em timestamptz not null default now()
);
create index ficha_edicoes_por_ficha on public.ficha_edicoes (ficha_id, criado_em desc);

alter table public.ficha_edicoes enable row level security;
revoke all on public.ficha_edicoes from anon;
create policy ficha_edicoes_select on public.ficha_edicoes for select to authenticated using (public.is_consultora());
-- sem insert/update/delete para usuários: só atualizar_campo (servidor) grava

-- ─── Gravação de 1 campo: atômica + histórico ───────────────────────────────
-- Devolve null se o valor não mudou (sem histórico e sem broadcast). Recusa ficha concluída/aprovada/cancelada.
create function public.atualizar_campo(p_ficha uuid, p_campo text, p_valor jsonb, p_origem text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_status public.status_ficha;
  v_ant jsonb;
  v_novo jsonb := coalesce(p_valor, 'null'::jsonb);
  v_em timestamptz := now();
begin
  select status, dados_atuais -> p_campo into v_status, v_ant from public.fichas where id = p_ficha for update;
  if not found then raise exception 'ficha_inexistente' using errcode = 'P0002'; end if;
  if v_status in ('concluida', 'aprovada', 'cancelada') then raise exception 'ficha_bloqueada' using errcode = 'P0001'; end if;
  if coalesce(v_ant, 'null'::jsonb) = v_novo then return null; end if;

  update public.fichas set
    dados_atuais = jsonb_set(dados_atuais, array[p_campo], v_novo, true),
    status = case when status in ('gerada', 'enviada', 'aberta') then 'em_preenchimento' else status end
  where id = p_ficha;

  insert into public.ficha_edicoes (ficha_id, campo, valor_anterior, valor_novo, origem, criado_em)
  values (p_ficha, p_campo, v_ant, v_novo, p_origem, v_em);

  return jsonb_build_object('campo', p_campo, 'anterior', v_ant, 'novo', v_novo, 'em', v_em);
end $$;

revoke execute on function public.atualizar_campo(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.atualizar_campo(uuid, text, jsonb, text) to service_role;
