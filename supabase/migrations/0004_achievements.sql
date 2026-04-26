-- =====================================================================
-- Alpiclub — Achievements (conquistas e premiações)
-- Peer-to-peer recognition. Anyone can grant. Cannot grant to self.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum: achievement category
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'achievement_category') then
    create type public.achievement_category as enum (
      'trabalho_em_equipe',
      'excelencia_tecnica',
      'inovacao',
      'lideranca',
      'iniciativa',
      'cultura',
      'premiacao',
      'outro'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------
create table public.achievements (
  id             uuid primary key default gen_random_uuid(),
  recipient_id   uuid not null references public.profiles(id) on delete cascade,
  granted_by_id  uuid not null references public.profiles(id) on delete set null,
  category       public.achievement_category not null default 'outro',
  title          text not null,
  message        text,
  granted_at     timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint achievements_no_self_grant check (recipient_id <> granted_by_id),
  constraint achievements_title_not_blank check (length(trim(title)) > 0)
);

comment on table public.achievements is
  'Reconhecimentos peer-to-peer entre colaboradores (conquistas e premiações)';

create index achievements_recipient_idx  on public.achievements (recipient_id);
create index achievements_granted_by_idx on public.achievements (granted_by_id);
create index achievements_granted_at_idx on public.achievements (granted_at desc);
create index achievements_category_idx   on public.achievements (category);

create trigger achievements_set_updated_at
  before update on public.achievements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
alter table public.achievements enable row level security;

-- Read: anyone authenticated
create policy "achievements_select_authenticated"
  on public.achievements for select
  to authenticated
  using (true);

-- Insert: must grant *as yourself* (cannot fake the granter)
create policy "achievements_insert_self_as_granter"
  on public.achievements for insert
  to authenticated
  with check (granted_by_id = auth.uid());

-- Update: only the original granter can edit their own
create policy "achievements_update_own"
  on public.achievements for update
  to authenticated
  using (granted_by_id = auth.uid())
  with check (granted_by_id = auth.uid());

-- Delete: granter or admin
create policy "achievements_delete_own_or_admin"
  on public.achievements for delete
  to authenticated
  using (granted_by_id = auth.uid() or public.is_admin());
