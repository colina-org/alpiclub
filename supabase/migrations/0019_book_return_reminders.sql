-- =====================================================================
-- Alpiclub — Lembrete automático de devolução de livros
-- Cria notificação para quem está com livro emprestado há > 30 dias.
-- Roda diariamente via pg_cron. Limita 1 lembrete por semana por livro
-- para não floodar a pessoa.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Adiciona o novo tipo de notificação
-- ---------------------------------------------------------------------
alter type public.notification_type add value if not exists 'book_return_reminder';

-- ---------------------------------------------------------------------
-- 2. Função que verifica empréstimos vencidos e notifica
-- ---------------------------------------------------------------------
create or replace function public.notify_overdue_borrowings()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select
      b.id          as borrowing_id,
      b.book_id,
      b.profile_id,
      b.borrowed_at,
      bk.title      as book_title,
      extract(day from now() - b.borrowed_at)::int as days_overdue
    from public.book_borrowings b
    join public.books bk on bk.id = b.book_id
    where b.status = 'borrowed'
      and b.borrowed_at < now() - interval '30 days'
      -- Não duplica: ignora se já enviou lembrete pra esta pessoa+livro nos últimos 7 dias.
      and not exists (
        select 1
        from public.notifications n
        where n.profile_id = b.profile_id
          and n.type = 'book_return_reminder'
          and n.link = '/biblioteca/' || b.book_id
          and n.created_at > now() - interval '7 days'
      )
  loop
    insert into public.notifications (profile_id, type, title, message, link)
    values (
      rec.profile_id,
      'book_return_reminder',
      'Lembrete de devolução 📚',
      'Você está com "' || rec.book_title || '" há ' || rec.days_overdue || ' dias. Quando terminar, devolva pra que outros possam ler.',
      '/biblioteca/' || rec.book_id
    );
  end loop;
end;
$$;

comment on function public.notify_overdue_borrowings() is
  'Notifica quem está com livro da Bibliotech há mais de 30 dias. Idempotente (1 lembrete/semana).';

-- ---------------------------------------------------------------------
-- 3. Agenda execução diária via pg_cron
-- ---------------------------------------------------------------------
-- Requer a extensão pg_cron. Em Supabase: Database → Extensions → enable "pg_cron".
-- Se não estiver ativada, o bloco apenas avisa e não falha.

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice
      'pg_cron NÃO ESTÁ ATIVADO. Ative em Database → Extensions e rode este script novamente para agendar o lembrete diário. A função notify_overdue_borrowings() já está criada e pode ser chamada manualmente.';
    return;
  end if;

  -- Remove agendamento antigo (caso exista) antes de recriar.
  if exists (select 1 from cron.job where jobname = 'notify-overdue-borrowings') then
    perform cron.unschedule('notify-overdue-borrowings');
  end if;

  -- Roda todo dia às 12:00 UTC (= 09:00 BRT).
  perform cron.schedule(
    'notify-overdue-borrowings',
    '0 12 * * *',
    $sql$ select public.notify_overdue_borrowings(); $sql$
  );
end $$;
