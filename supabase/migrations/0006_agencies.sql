-- =====================================================================
-- Alpiclub — Agencies
-- Colina Tech (holding) contém múltiplas agências (Colina Tech, Larco, Buzco...).
-- Cada equipe pertence a uma agência. Cada pessoa pertence a uma equipe.
-- Conquistas, Biblioteca etc. continuam compartilhados entre agências.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. agencies
-- ---------------------------------------------------------------------
create table public.agencies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  slug          text not null unique,
  description   text,
  logo_url      text,
  color         text default '#0d9b6c',
  website_url   text,
  instagram_url text,
  linkedin_url  text,
  facebook_url  text,
  youtube_url   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint agencies_name_not_blank check (length(trim(name)) > 0),
  constraint agencies_slug_format    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on table public.agencies is
  'Agências da holding Colina Tech (a holding em si + agências irmãs como Larco, Buzco)';

create index agencies_slug_idx on public.agencies (slug);

create trigger agencies_set_updated_at
  before update on public.agencies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. Seed: Colina Tech (a holding aparece como uma "agência" também)
-- ---------------------------------------------------------------------
insert into public.agencies (name, slug, description, color, website_url)
values (
  'Colina Tech',
  'colina-tech',
  'Marketing digital com resultados mensuráveis.',
  '#0d9b6c',
  'https://colinatech.com.br'
)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 3. teams.agency_id (cada equipe pertence a uma agência)
-- ---------------------------------------------------------------------
alter table public.teams
  add column if not exists agency_id uuid references public.agencies(id) on delete restrict;

-- Backfill: equipes existentes vão para Colina Tech.
update public.teams
set agency_id = (select id from public.agencies where slug = 'colina-tech')
where agency_id is null;

-- Agora torna obrigatório.
alter table public.teams
  alter column agency_id set not null;

create index if not exists teams_agency_id_idx on public.teams (agency_id);

-- ---------------------------------------------------------------------
-- 4. RLS — leitura pública (autenticados), edição/criação só admin
-- ---------------------------------------------------------------------
alter table public.agencies enable row level security;

create policy "agencies_select_authenticated"
  on public.agencies for select
  to authenticated
  using (true);

create policy "agencies_admin_all"
  on public.agencies for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
