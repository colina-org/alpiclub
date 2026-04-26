-- =====================================================================
-- Alpiclub — Initial schema
-- Tables: teams, profiles
-- Includes: RLS, auto-create profile trigger, updated_at trigger
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'member');

-- ---------------------------------------------------------------------
-- 2. teams
-- ---------------------------------------------------------------------
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  color       text default '#0d9b6c',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.teams is 'Equipes / operações da Colina Tech';

-- ---------------------------------------------------------------------
-- 3. profiles (extends auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text,
  email             text not null,
  avatar_url        text,
  position          text,
  team_id           uuid references public.teams(id) on delete set null,
  is_head           boolean not null default false,
  app_role          public.app_role not null default 'member',
  bio               text,
  birthday          date,
  joined_at         date,
  clickup_user_id   text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público de cada colaborador, vinculado 1:1 a auth.users';
comment on column public.profiles.is_head is 'Marca o head/responsável principal da equipe';
comment on column public.profiles.app_role is 'Permissão interna do Alpiclub (admin = pode gerenciar)';

create index profiles_team_id_idx on public.profiles (team_id);
create index profiles_app_role_idx on public.profiles (app_role);

-- ---------------------------------------------------------------------
-- 4. updated_at auto-update trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. Auto-create profile when a new auth.users row is inserted
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 6. Helper: is the current user an admin?
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and app_role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------
alter table public.teams    enable row level security;
alter table public.profiles enable row level security;

-- teams: any authenticated user can read; only admins can write
create policy "teams_select_authenticated"
  on public.teams for select
  to authenticated
  using (true);

create policy "teams_admin_all"
  on public.teams for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- profiles: any authenticated user can read all profiles
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- profiles: a user can update their own profile (but cannot change app_role/team_id/is_head)
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and app_role = (select app_role from public.profiles where id = auth.uid())
    and is_head  = (select is_head  from public.profiles where id = auth.uid())
    and (team_id is not distinct from (select team_id from public.profiles where id = auth.uid()))
  );

-- profiles: admins can update anything
create policy "profiles_admin_update"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- profiles: admins can delete
create policy "profiles_admin_delete"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- profile rows are inserted by the trigger above (security definer), not directly.
-- No INSERT policy needed for normal users.
