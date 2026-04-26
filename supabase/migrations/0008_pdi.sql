-- =====================================================================
-- Alpiclub — PDI (Plano de Desenvolvimento Individual)
-- Privado: visível apenas para a própria pessoa, Head/Líder da mesma equipe e admin.
-- Head e Líder podem comentar (check-ins). Apenas o dono (ou admin) edita as metas.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'pdi_cycle_status') then
    create type public.pdi_cycle_status as enum ('active', 'completed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'pdi_goal_status') then
    create type public.pdi_goal_status as enum ('not_started', 'in_progress', 'completed', 'paused');
  end if;
  if not exists (select 1 from pg_type where typname = 'pdi_goal_category') then
    create type public.pdi_goal_category as enum (
      'hard_skill', 'soft_skill', 'leadership', 'business', 'other'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------
create table public.pdi_cycles (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  status      public.pdi_cycle_status not null default 'active',
  started_at  date,
  ends_at     date,
  summary     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint pdi_cycles_title_not_blank check (length(trim(title)) > 0)
);

comment on table public.pdi_cycles is 'Ciclo de PDI de uma pessoa (ex.: PDI 2026 H1)';

create index pdi_cycles_profile_idx on public.pdi_cycles (profile_id);
create index pdi_cycles_status_idx  on public.pdi_cycles (status);

create trigger pdi_cycles_set_updated_at
  before update on public.pdi_cycles
  for each row execute function public.set_updated_at();

create table public.pdi_goals (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references public.pdi_cycles(id) on delete cascade,
  title        text not null,
  description  text,
  category     public.pdi_goal_category not null default 'other',
  status       public.pdi_goal_status not null default 'not_started',
  progress     int not null default 0,
  target_date  date,
  priority     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint pdi_goals_title_not_blank check (length(trim(title)) > 0),
  constraint pdi_goals_progress_range check (progress between 0 and 100)
);

comment on table public.pdi_goals is 'Meta dentro de um ciclo de PDI';

create index pdi_goals_cycle_idx  on public.pdi_goals (cycle_id);
create index pdi_goals_status_idx on public.pdi_goals (status);

create trigger pdi_goals_set_updated_at
  before update on public.pdi_goals
  for each row execute function public.set_updated_at();

create table public.pdi_check_ins (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid not null references public.pdi_cycles(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete set null,
  message     text not null,
  created_at  timestamptz not null default now(),
  constraint pdi_check_ins_message_not_blank check (length(trim(message)) > 0)
);

comment on table public.pdi_check_ins is 'Comentário/feedback de gestor (Head ou Líder) num ciclo de PDI';

create index pdi_check_ins_cycle_idx on public.pdi_check_ins (cycle_id);

-- ---------------------------------------------------------------------
-- 3. Helper: can_view_pdi(target_profile_id)
--    Retorna true se o usuário atual é:
--      - dono do PDI
--      - admin
--      - Head ou Líder da mesma equipe que o dono
-- ---------------------------------------------------------------------
create or replace function public.can_view_pdi(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    auth.uid() = target_profile_id
    or public.is_admin()
    or exists (
      select 1
      from public.profiles me
      join public.profiles target on target.id = target_profile_id
      where me.id = auth.uid()
        and me.team_id is not null
        and me.team_id = target.team_id
        and (me.is_head or me.is_lead)
    );
$$;

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.pdi_cycles    enable row level security;
alter table public.pdi_goals     enable row level security;
alter table public.pdi_check_ins enable row level security;

-- ----- pdi_cycles -----
create policy "pdi_cycles_select_view_pdi"
  on public.pdi_cycles for select
  to authenticated
  using (public.can_view_pdi(profile_id));

create policy "pdi_cycles_insert_self_or_admin"
  on public.pdi_cycles for insert
  to authenticated
  with check (profile_id = auth.uid() or public.is_admin());

create policy "pdi_cycles_update_self_or_admin"
  on public.pdi_cycles for update
  to authenticated
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

create policy "pdi_cycles_delete_self_or_admin"
  on public.pdi_cycles for delete
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- ----- pdi_goals -----
create policy "pdi_goals_select_via_cycle"
  on public.pdi_goals for select
  to authenticated
  using (
    exists (
      select 1 from public.pdi_cycles c
      where c.id = pdi_goals.cycle_id
        and public.can_view_pdi(c.profile_id)
    )
  );

create policy "pdi_goals_write_via_cycle_owner"
  on public.pdi_goals for all
  to authenticated
  using (
    exists (
      select 1 from public.pdi_cycles c
      where c.id = pdi_goals.cycle_id
        and (c.profile_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.pdi_cycles c
      where c.id = pdi_goals.cycle_id
        and (c.profile_id = auth.uid() or public.is_admin())
    )
  );

-- ----- pdi_check_ins -----
create policy "pdi_check_ins_select_via_cycle"
  on public.pdi_check_ins for select
  to authenticated
  using (
    exists (
      select 1 from public.pdi_cycles c
      where c.id = pdi_check_ins.cycle_id
        and public.can_view_pdi(c.profile_id)
    )
  );

-- Inserir um check-in: precisa poder ver o PDI E ser o autor.
create policy "pdi_check_ins_insert_authorized"
  on public.pdi_check_ins for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.pdi_cycles c
      where c.id = pdi_check_ins.cycle_id
        and public.can_view_pdi(c.profile_id)
    )
  );

-- Editar/excluir o próprio check-in (ou admin).
create policy "pdi_check_ins_update_own_or_admin"
  on public.pdi_check_ins for update
  to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

create policy "pdi_check_ins_delete_own_or_admin"
  on public.pdi_check_ins for delete
  to authenticated
  using (author_id = auth.uid() or public.is_admin());
