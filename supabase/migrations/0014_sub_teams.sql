-- =====================================================================
-- Alpiclub — Sub-equipes (1 nível de profundidade)
-- Adiciona parent_team_id em teams. Sub-equipes:
--   - Pertencem à mesma agência do pai (auto-sincronizado)
--   - Têm seu próprio Head/Líder/Membros
--   - Profundidade máxima: 1 (pai → filho, sem netos)
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

alter table public.teams
  add column if not exists parent_team_id uuid references public.teams(id) on delete cascade;

comment on column public.teams.parent_team_id is
  'NULL = equipe raiz. Não-NULL = sub-equipe da equipe referenciada. Profundidade máxima 1.';

create index if not exists teams_parent_team_idx on public.teams (parent_team_id);

-- ---------------------------------------------------------------------
-- Trigger de validação e sincronização
--   1) parent_team_id deve existir
--   2) Profundidade máxima 1: o pai não pode ter pai
--   3) Se a equipe já tem sub-equipes, não pode virar sub-equipe
--   4) Sub-equipe herda agency_id do pai (auto-sync)
-- ---------------------------------------------------------------------
create or replace function public.handle_team_hierarchy()
returns trigger
language plpgsql
as $$
declare
  parent_record record;
begin
  if new.parent_team_id is not null then
    -- Não permitir auto-referência.
    if new.parent_team_id = new.id then
      raise exception 'Uma equipe não pode ser pai de si mesma.';
    end if;

    select agency_id, parent_team_id
      into parent_record
      from public.teams
      where id = new.parent_team_id;

    if not found then
      raise exception 'Equipe-pai não existe.';
    end if;

    -- Profundidade máxima 1.
    if parent_record.parent_team_id is not null then
      raise exception 'Sub-equipes só podem ter 1 nível de profundidade.';
    end if;

    -- Se essa equipe já tem sub-equipes, não pode virar sub-equipe.
    if exists (
      select 1 from public.teams
      where parent_team_id = new.id
        and (tg_op = 'INSERT' or id <> new.id)
    ) then
      raise exception 'Esta equipe já tem sub-equipes; não pode virar sub-equipe.';
    end if;

    -- Auto-sincroniza agência com a do pai.
    new.agency_id := parent_record.agency_id;
  end if;
  return new;
end;
$$;

drop trigger if exists teams_handle_hierarchy on public.teams;
create trigger teams_handle_hierarchy
  before insert or update on public.teams
  for each row execute function public.handle_team_hierarchy();
