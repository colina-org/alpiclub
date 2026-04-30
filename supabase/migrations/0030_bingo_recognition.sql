-- =====================================================================
-- Alpiclub — Bingo do Reconhecimento
-- Cada colaborador pode votar uma vez por sexta-feira.
-- Escolhe entre reconhecimento profissional ou pessoal.
-- =====================================================================

create type public.recognition_type as enum ('professional', 'personal');

create table public.recognition_votes (
  id           uuid primary key default gen_random_uuid(),
  voter_id     uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type         public.recognition_type not null,
  icon_count   integer not null default 1 check (icon_count between 1 and 5),
  comment      text not null check (length(trim(comment)) > 0),
  week_date    date not null,   -- sempre a sexta-feira da semana do voto
  created_at   timestamptz not null default now(),

  -- 1 voto por eleitor por semana
  unique (voter_id, week_date),
  -- não pode votar em si mesmo (reforço no banco)
  check (voter_id <> recipient_id)
);

comment on table public.recognition_votes is
  'Votos semanais do Bingo do Reconhecimento. Um voto por eleitor por sexta-feira.';

comment on column public.recognition_votes.week_date is
  'Data da sexta-feira da semana do voto (normaliza qualquer dia para a sexta).';

create index recognition_votes_recipient_idx on public.recognition_votes (recipient_id);
create index recognition_votes_week_idx      on public.recognition_votes (week_date);
create index recognition_votes_voter_idx     on public.recognition_votes (voter_id);

alter table public.recognition_votes enable row level security;

-- Leitura: qualquer autenticado vê todos os votos (necessário para o ranking)
create policy "recognition_votes_select"
  on public.recognition_votes for select
  to authenticated using (true);

-- Insert: só como você mesmo, e apenas 1 por semana (unique garante)
create policy "recognition_votes_insert"
  on public.recognition_votes for insert
  to authenticated
  with check (voter_id = auth.uid());

-- Delete: admin pode remover (moderação)
create policy "recognition_votes_admin_delete"
  on public.recognition_votes for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and app_role = 'admin'
    )
  );

-- ── View de ranking ───────────────────────────────────────────────────
create or replace view public.recognition_ranking as
select
  p.id,
  p.full_name,
  p.email,
  p.avatar_url,
  p.position,
  count(*) filter (where v.type = 'professional') as professional_count,
  count(*) filter (where v.type = 'personal')     as personal_count,
  count(*)                                          as total_count
from public.profiles p
left join public.recognition_votes v on v.recipient_id = p.id
where p.archived_at is null
group by p.id, p.full_name, p.email, p.avatar_url, p.position
order by total_count desc, professional_count desc;

comment on view public.recognition_ranking is
  'Ranking do Bingo: total de reconhecimentos, desempate por profissional.';

grant select on public.recognition_ranking to authenticated;
