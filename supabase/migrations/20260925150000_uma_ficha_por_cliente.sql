-- Uma ficha ativa por cliente: a ficha é ATUALIZADA (nunca duplicada) enquanto o cliente não a devolveu.
-- Depois de devolvida, os dados do cliente ficam em dados_respondidos e o RD novo só aparece para comparação.

alter table public.fichas add column snapshot_atualizado_em timestamptz;

-- fichas duplicadas que já existem (testes): fica a mais recente; as outras viram "cancelada" (nada é apagado)
with ordenadas as (
  select id, row_number() over (partition by cliente_id order by criado_em desc) as posicao
  from public.fichas
  where status <> 'cancelada'
)
update public.fichas f
set status = 'cancelada'
from ordenadas o
where f.id = o.id and o.posicao > 1;

create unique index fichas_uma_ativa_por_cliente on public.fichas (cliente_id) where status <> 'cancelada';
