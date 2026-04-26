-- =====================================================================
-- Alpiclub — Notifications
-- Cada notificação é destinada a um profile_id. Triggers no banco
-- inserem automaticamente quando rolam eventos relevantes.
-- Eventos no MVP:
--   - 'achievement_received'  : você ganhou uma conquista
--   - 'pdi_comment'           : comentaram no seu PDI
--   - 'pdi_goal_updated'      : alguém atualizou status/progresso de uma meta sua
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum + tabela
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'achievement_received',
      'pdi_comment',
      'pdi_goal_updated'
    );
  end if;
end $$;

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  type        public.notification_type not null,
  title       text not null,
  message     text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.notifications is
  'Notificações pessoais (uma linha por destinatário)';

create index notifications_profile_idx     on public.notifications (profile_id);
create index notifications_unread_idx      on public.notifications (profile_id, read_at)
  where read_at is null;
create index notifications_created_at_idx  on public.notifications (created_at desc);

-- ---------------------------------------------------------------------
-- 2. RLS — usuário só enxerga e marca as próprias
-- ---------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (profile_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "notifications_delete_own"
  on public.notifications for delete
  to authenticated
  using (profile_id = auth.uid());

-- INSERT é feito pelos triggers (security definer), sem policy direta.

-- ---------------------------------------------------------------------
-- 3. Trigger: nova conquista → notifica o destinatário
-- ---------------------------------------------------------------------
create or replace function public.notify_achievement_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  granter_name text;
begin
  -- Não auto-notifica (já temos constraint que impede self-grant, mas redundante check).
  if new.recipient_id = new.granted_by_id then
    return new;
  end if;

  select coalesce(full_name, split_part(email, '@', 1))
    into granter_name
    from public.profiles
    where id = new.granted_by_id;

  insert into public.notifications (profile_id, type, title, message, link)
  values (
    new.recipient_id,
    'achievement_received',
    'Você recebeu uma conquista',
    coalesce(granter_name, 'Alguém') || ' reconheceu você: ' || new.title,
    '/conquistas'
  );

  return new;
end;
$$;

drop trigger if exists on_achievement_inserted on public.achievements;
create trigger on_achievement_inserted
  after insert on public.achievements
  for each row execute function public.notify_achievement_received();

-- ---------------------------------------------------------------------
-- 4. Trigger: novo check-in no PDI → notifica o dono do ciclo
-- ---------------------------------------------------------------------
create or replace function public.notify_pdi_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle_owner uuid;
  author_name text;
begin
  select profile_id into cycle_owner
    from public.pdi_cycles
    where id = new.cycle_id;

  -- Sem dono (caso raríssimo) ou comentou no próprio PDI: sem notificação.
  if cycle_owner is null or cycle_owner = new.author_id then
    return new;
  end if;

  select coalesce(full_name, split_part(email, '@', 1))
    into author_name
    from public.profiles
    where id = new.author_id;

  insert into public.notifications (profile_id, type, title, message, link)
  values (
    cycle_owner,
    'pdi_comment',
    'Novo comentário no seu PDI',
    coalesce(author_name, 'Alguém') || ' deixou um comentário no seu PDI.',
    '/pdi'
  );

  return new;
end;
$$;

drop trigger if exists on_pdi_check_in_inserted on public.pdi_check_ins;
create trigger on_pdi_check_in_inserted
  after insert on public.pdi_check_ins
  for each row execute function public.notify_pdi_comment();

-- ---------------------------------------------------------------------
-- 5. Trigger: meta de PDI atualizada (status/progresso) → notifica o dono
--             apenas se quem mudou NÃO foi o próprio dono.
-- ---------------------------------------------------------------------
create or replace function public.notify_pdi_goal_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle_owner uuid;
  actor uuid;
  actor_name text;
begin
  -- Só dispara se status ou progress mudou de fato.
  if old.status = new.status and old.progress = new.progress then
    return new;
  end if;

  actor := auth.uid();
  if actor is null then
    return new; -- update fora de sessão (raro), ignora.
  end if;

  select profile_id into cycle_owner
    from public.pdi_cycles
    where id = new.cycle_id;

  if cycle_owner is null or cycle_owner = actor then
    return new; -- dono atualizou a própria meta: sem notificação
  end if;

  select coalesce(full_name, split_part(email, '@', 1))
    into actor_name
    from public.profiles
    where id = actor;

  insert into public.notifications (profile_id, type, title, message, link)
  values (
    cycle_owner,
    'pdi_goal_updated',
    'Sua meta foi atualizada',
    coalesce(actor_name, 'Alguém') || ' atualizou: ' || new.title,
    '/pdi'
  );

  return new;
end;
$$;

drop trigger if exists on_pdi_goal_updated on public.pdi_goals;
create trigger on_pdi_goal_updated
  after update on public.pdi_goals
  for each row execute function public.notify_pdi_goal_updated();
