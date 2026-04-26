-- =====================================================================
-- Alpiclub — Sócios (Partners) + Nova hierarquia de PDI
--
-- 1) Tabela agency_partners (sócios de uma agência, M:N profile↔agency)
-- 2) Helpers: is_partner_of(agency), is_head_of_agency(agency), can_manage_agency(agency)
-- 3) RLS de agencies aberto para admin + sócios + Heads de equipes da agência
-- 4) can_view_pdi reescrito com hierarquia ESTRITA imediata:
--      - Sócio gerencia PDI do Head
--      - Head gerencia PDI do Líder
--      - Líder gerencia PDI do Membro
--      (own e admin continuam podendo)
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. agency_partners
-- ---------------------------------------------------------------------
create table public.agency_partners (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (agency_id, profile_id)
);

comment on table public.agency_partners is
  'Sócios (partners) de uma agência. Uma pessoa pode ser sócia de múltiplas agências.';

create index agency_partners_agency_idx  on public.agency_partners (agency_id);
create index agency_partners_profile_idx on public.agency_partners (profile_id);

alter table public.agency_partners enable row level security;

-- Leitura pública (autenticados); escrita só admin (por enquanto).
create policy "agency_partners_select_authenticated"
  on public.agency_partners for select
  to authenticated
  using (true);

create policy "agency_partners_admin_write"
  on public.agency_partners for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_partner_of(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.agency_partners
    where profile_id = auth.uid()
      and agency_id = target_agency_id
  );
$$;

create or replace function public.is_head_of_agency(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles me
    join public.teams t on t.id = me.team_id
    where me.id = auth.uid()
      and me.is_head
      and t.agency_id = target_agency_id
  );
$$;

create or replace function public.can_manage_agency(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_admin()
    or public.is_partner_of(target_agency_id)
    or public.is_head_of_agency(target_agency_id);
$$;

-- ---------------------------------------------------------------------
-- 3. RLS de agencies — admin + sócios + Heads podem editar/excluir
-- ---------------------------------------------------------------------
drop policy if exists "agencies_admin_all" on public.agencies;

create policy "agencies_manage_authorized"
  on public.agencies for all
  to authenticated
  using (public.can_manage_agency(id))
  with check (public.can_manage_agency(id));

-- ---------------------------------------------------------------------
-- 4. can_view_pdi reescrito com hierarquia estrita
-- ---------------------------------------------------------------------
create or replace function public.can_view_pdi(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    -- Próprio dono
    auth.uid() = target_profile_id
    -- Admin
    or public.is_admin()
    -- Sócio gerencia PDI do Head (da agência da equipe do target)
    or exists (
      select 1
      from public.profiles target
      join public.teams t on t.id = target.team_id
      where target.id = target_profile_id
        and target.is_head
        and public.is_partner_of(t.agency_id)
    )
    -- Head da equipe gerencia PDI do Líder
    or exists (
      select 1
      from public.profiles me, public.profiles target
      where me.id = auth.uid()
        and target.id = target_profile_id
        and me.team_id is not null
        and me.team_id = target.team_id
        and me.is_head
        and target.is_lead
    )
    -- Líder da equipe gerencia PDI do Membro (não-Head, não-Líder)
    or exists (
      select 1
      from public.profiles me, public.profiles target
      where me.id = auth.uid()
        and target.id = target_profile_id
        and me.team_id is not null
        and me.team_id = target.team_id
        and me.is_lead
        and not target.is_head
        and not target.is_lead
    );
$$;
