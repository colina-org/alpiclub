-- =====================================================================
-- Alpiclub — Ranking de Alpicoins
-- View pública (aggregada) que expõe apenas o saldo total por usuário.
-- Roda como owner (security definer implícito em views) para contornar
-- a RLS das transactions sem expor movimentações individuais.
-- =====================================================================

create or replace view public.alpicoins_ranking as
select
  p.id,
  p.full_name,
  p.email,
  p.avatar_url,
  p.position,
  coalesce(sum(t.coins), 0)::integer as balance
from public.profiles p
left join public.alpicoins_transactions t on t.profile_id = p.id
where p.archived_at is null
group by p.id, p.full_name, p.email, p.avatar_url, p.position
order by balance desc;

comment on view public.alpicoins_ranking is
  'Ranking público de Alpicoins: saldo total por colaborador ativo.';

grant select on public.alpicoins_ranking to authenticated;
