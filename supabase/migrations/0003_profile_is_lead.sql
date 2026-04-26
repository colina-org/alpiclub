-- =====================================================================
-- Alpiclub — Add is_lead to profiles
-- Adds a third layer to the org chart: Head → Líderes → Membros.
-- A person cannot be both head and lead at the same time.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

alter table public.profiles
  add column if not exists is_lead boolean not null default false;

comment on column public.profiles.is_lead is
  'Líder de uma sub-área dentro da equipe. Mutuamente exclusivo com is_head.';

-- Mutual exclusion: a profile cannot be both head and lead.
alter table public.profiles
  drop constraint if exists profiles_head_lead_exclusive;

alter table public.profiles
  add constraint profiles_head_lead_exclusive
  check (not (is_head and is_lead));

create index if not exists profiles_is_lead_idx on public.profiles (is_lead);
