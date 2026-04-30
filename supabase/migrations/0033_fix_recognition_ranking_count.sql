-- =====================================================================
-- Corrige recognition_ranking: count(*) contava a linha do LEFT JOIN
-- mesmo sem votos. Substituído por count(v.id) que retorna 0 quando
-- não há registros correspondentes.
-- =====================================================================

create or replace view public.recognition_ranking as
select
  p.id,
  p.full_name,
  p.email,
  p.avatar_url,
  p.position,
  count(v.id) filter (where v.type = 'professional') as professional_count,
  count(v.id) filter (where v.type = 'personal')     as personal_count,
  count(v.id)                                          as total_count
from public.profiles p
left join public.recognition_votes v on v.recipient_id = p.id
where p.archived_at is null
group by p.id, p.full_name, p.email, p.avatar_url, p.position
order by total_count desc, professional_count desc;

grant select on public.recognition_ranking to authenticated;
