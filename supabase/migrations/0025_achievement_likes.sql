-- =====================================================================
-- Alpiclub — Curtidas em conquistas
-- Cada pessoa pode curtir uma conquista uma única vez (toggle).
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

create table public.achievement_likes (
  id              uuid primary key default gen_random_uuid(),
  achievement_id  uuid not null references public.achievements(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (achievement_id, profile_id)
);

comment on table public.achievement_likes is
  'Reações de "curtir" em conquistas. Único por (conquista, pessoa).';

create index achievement_likes_achievement_idx on public.achievement_likes (achievement_id);
create index achievement_likes_profile_idx     on public.achievement_likes (profile_id);

alter table public.achievement_likes enable row level security;

-- Leitura: qualquer autenticado.
create policy "achievement_likes_select_authenticated"
  on public.achievement_likes for select
  to authenticated
  using (true);

-- Insert: só como você mesmo.
create policy "achievement_likes_insert_self"
  on public.achievement_likes for insert
  to authenticated
  with check (profile_id = auth.uid());

-- Delete: só o próprio like.
create policy "achievement_likes_delete_own"
  on public.achievement_likes for delete
  to authenticated
  using (profile_id = auth.uid());
