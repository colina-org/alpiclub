-- =====================================================================
-- Alpiclub — Bingo: lembrete semanal toda sexta às 08h (BRT = 11h UTC)
-- Requer extensão pg_cron habilitada no projeto Supabase.
-- =====================================================================

-- Função que insere notificações para todos os colaboradores ativos
create or replace function public.notify_bingo_friday()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, type, title, message, link)
  select
    id,
    'bingo_friday_reminder',
    '🎉 Bingo do Reconhecimento disponível!',
    'Hoje é sexta-feira! Você tem até o final do dia para reconhecer um colega.',
    '/bingo'
  from public.profiles
  where archived_at is null;
end;
$$;

-- Agenda o job: toda sexta-feira às 11:00 UTC (08:00 BRT)
select cron.schedule(
  'bingo-friday-reminder',   -- nome único do job
  '0 11 * * 5',              -- min hora dom mes dia-semana (5=sexta)
  $$ select public.notify_bingo_friday(); $$
);
