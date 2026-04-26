-- =====================================================================
-- Alpiclub — handle_new_user estendido
-- Lê team_id e position do raw_user_meta_data quando a pessoa é convidada
-- com esses dados pré-preenchidos pela Edge Function invite-user.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_team_id uuid;
begin
  -- team_id pode vir como string vazia ou faltando; tratamos os dois casos.
  begin
    meta_team_id := nullif(new.raw_user_meta_data ->> 'team_id', '')::uuid;
  exception when others then
    meta_team_id := null;
  end;

  insert into public.profiles (id, email, full_name, team_id, position)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    ),
    meta_team_id,
    nullif(new.raw_user_meta_data ->> 'position', '')
  );
  return new;
end;
$$;
