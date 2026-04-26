-- =====================================================================
-- Alpiclub — PDI Extensions
-- 1) Abre escrita de ciclos/metas para Head/Líder da mesma equipe (co-dono)
-- 2) Snapshot de fechamento de ciclo (auto + gestor)
-- 3) Vincular livros/cursos/conquistas a metas (pdi_goal_resources)
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RLS: trocar "dono ou admin" por can_view_pdi (que já inclui Head/Líder)
-- ---------------------------------------------------------------------

-- pdi_cycles
drop policy if exists "pdi_cycles_insert_self_or_admin" on public.pdi_cycles;
drop policy if exists "pdi_cycles_update_self_or_admin" on public.pdi_cycles;
drop policy if exists "pdi_cycles_delete_self_or_admin" on public.pdi_cycles;

create policy "pdi_cycles_insert_authorized"
  on public.pdi_cycles for insert
  to authenticated
  with check (public.can_view_pdi(profile_id));

create policy "pdi_cycles_update_authorized"
  on public.pdi_cycles for update
  to authenticated
  using (public.can_view_pdi(profile_id))
  with check (public.can_view_pdi(profile_id));

create policy "pdi_cycles_delete_authorized"
  on public.pdi_cycles for delete
  to authenticated
  using (public.can_view_pdi(profile_id));

-- pdi_goals
drop policy if exists "pdi_goals_write_via_cycle_owner" on public.pdi_goals;

create policy "pdi_goals_write_via_cycle_authorized"
  on public.pdi_goals for all
  to authenticated
  using (
    exists (
      select 1 from public.pdi_cycles c
      where c.id = pdi_goals.cycle_id
        and public.can_view_pdi(c.profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.pdi_cycles c
      where c.id = pdi_goals.cycle_id
        and public.can_view_pdi(c.profile_id)
    )
  );

-- ---------------------------------------------------------------------
-- 2. Snapshot de fechamento (campos novos em pdi_cycles)
-- ---------------------------------------------------------------------
alter table public.pdi_cycles
  add column if not exists self_assessment           text,
  add column if not exists self_assessment_score     int,
  add column if not exists manager_assessment        text,
  add column if not exists manager_assessment_score  int,
  add column if not exists manager_assessment_by_id  uuid references public.profiles(id) on delete set null,
  add column if not exists closed_at                 timestamptz;

alter table public.pdi_cycles
  drop constraint if exists pdi_cycles_self_score_range;
alter table public.pdi_cycles
  add constraint pdi_cycles_self_score_range
  check (self_assessment_score is null or self_assessment_score between 1 and 5);

alter table public.pdi_cycles
  drop constraint if exists pdi_cycles_manager_score_range;
alter table public.pdi_cycles
  add constraint pdi_cycles_manager_score_range
  check (manager_assessment_score is null or manager_assessment_score between 1 and 5);

-- ---------------------------------------------------------------------
-- 3. pdi_goal_resources — vincula livros / cursos / conquistas a metas
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'pdi_resource_type') then
    create type public.pdi_resource_type as enum ('book', 'course', 'achievement');
  end if;
end $$;

create table public.pdi_goal_resources (
  id            uuid primary key default gen_random_uuid(),
  goal_id       uuid not null references public.pdi_goals(id) on delete cascade,
  resource_type public.pdi_resource_type not null,
  resource_id   uuid not null,
  created_at    timestamptz not null default now(),
  unique (goal_id, resource_type, resource_id)
);

comment on table public.pdi_goal_resources is
  'Liga uma meta de PDI a um livro, curso ou conquista (evidência de execução)';

create index pdi_goal_resources_goal_idx on public.pdi_goal_resources (goal_id);
create index pdi_goal_resources_lookup_idx
  on public.pdi_goal_resources (resource_type, resource_id);

alter table public.pdi_goal_resources enable row level security;

-- Mesma regra das metas: visível e editável por quem pode gerenciar o PDI.
create policy "pdi_goal_resources_select_via_goal"
  on public.pdi_goal_resources for select
  to authenticated
  using (
    exists (
      select 1
      from public.pdi_goals g
      join public.pdi_cycles c on c.id = g.cycle_id
      where g.id = pdi_goal_resources.goal_id
        and public.can_view_pdi(c.profile_id)
    )
  );

create policy "pdi_goal_resources_write_via_goal"
  on public.pdi_goal_resources for all
  to authenticated
  using (
    exists (
      select 1
      from public.pdi_goals g
      join public.pdi_cycles c on c.id = g.cycle_id
      where g.id = pdi_goal_resources.goal_id
        and public.can_view_pdi(c.profile_id)
    )
  )
  with check (
    exists (
      select 1
      from public.pdi_goals g
      join public.pdi_cycles c on c.id = g.cycle_id
      where g.id = pdi_goal_resources.goal_id
        and public.can_view_pdi(c.profile_id)
    )
  );
