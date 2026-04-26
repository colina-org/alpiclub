-- =====================================================================
-- Alpiclub — Courses
-- Per-profile learning track (não é catálogo compartilhado).
-- Cada pessoa gerencia seus próprios cursos como parte do desenvolvimento.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum: course status
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'course_status') then
    create type public.course_status as enum ('planned', 'in_progress', 'completed');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. courses table
-- ---------------------------------------------------------------------
create table public.courses (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  title           text not null,
  provider        text,
  url             text,
  status          public.course_status not null default 'planned',
  workload_hours  numeric(6, 1),
  started_at      date,
  finished_at     date,
  certificate_url text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint courses_title_not_blank check (length(trim(title)) > 0),
  constraint courses_workload_positive check (workload_hours is null or workload_hours >= 0)
);

comment on table public.courses is
  'Cursos cadastrados por cada colaborador (desenvolvimento e aprendizado individual)';

create index courses_profile_idx on public.courses (profile_id);
create index courses_status_idx  on public.courses (status);

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. RLS — leitura pública (autenticados); escrita só do dono ou admin
-- ---------------------------------------------------------------------
alter table public.courses enable row level security;

create policy "courses_select_authenticated"
  on public.courses for select
  to authenticated
  using (true);

create policy "courses_insert_self_or_admin"
  on public.courses for insert
  to authenticated
  with check (profile_id = auth.uid() or public.is_admin());

create policy "courses_update_self_or_admin"
  on public.courses for update
  to authenticated
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

create policy "courses_delete_self_or_admin"
  on public.courses for delete
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());
