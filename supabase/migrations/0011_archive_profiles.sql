-- =====================================================================
-- Alpiclub — Arquivamento de pessoas (soft delete)
-- Adiciona archived_at em profiles. Pessoa arquivada some das listas
-- ativas mas mantém histórico (conquistas, livros, PDI, comentários).
-- A revogação do login é feita via Edge Function (archive-user) que
-- também bana o usuário no auth.users.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

alter table public.profiles
  add column if not exists archived_at timestamptz;

comment on column public.profiles.archived_at is
  'Data de arquivamento. NULL = pessoa ativa. Setado pela Edge Function archive-user.';

-- Índice parcial só para os arquivados (pequena fração do total).
create index if not exists profiles_archived_at_idx
  on public.profiles (archived_at)
  where archived_at is not null;

-- Recria a policy de auto-edição para impedir que usuário comum altere
-- o próprio archived_at via update direto (só admin via Edge Function).
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and app_role = (select app_role from public.profiles where id = auth.uid())
    and is_head  = (select is_head  from public.profiles where id = auth.uid())
    and is_lead  = (select is_lead  from public.profiles where id = auth.uid())
    and (team_id is not distinct from (select team_id from public.profiles where id = auth.uid()))
    and (archived_at is not distinct from (select archived_at from public.profiles where id = auth.uid()))
  );
