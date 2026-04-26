-- =====================================================================
-- Alpiclub — Fila de espera (PARTE 2 de 2)
-- Roda SOMENTE depois de 0020 ter sido aplicado com sucesso.
-- Cria a constraint única, a função de promoção e o trigger.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- Constraint: 1 inscrição ativa por pessoa por livro
--    Impede mesma pessoa entrar 2x na fila ou ficar com 2 ativos.
-- ---------------------------------------------------------------------
create unique index if not exists book_borrowings_one_active_per_user_book
  on public.book_borrowings (book_id, profile_id)
  where status in ('queued', 'borrowed');

-- ---------------------------------------------------------------------
-- Trigger: ao marcar como devolvido, promove o próximo da fila
-- ---------------------------------------------------------------------
create or replace function public.promote_next_in_queue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_borrowing_id uuid;
  next_profile_id uuid;
  the_book_title text;
begin
  -- Só age na transição de qualquer status → 'returned'.
  if (old.status is distinct from 'returned') and new.status = 'returned' then
    -- Pega o próximo na fila (mais antigo primeiro).
    select id, profile_id
      into next_borrowing_id, next_profile_id
      from public.book_borrowings
      where book_id = new.book_id
        and status = 'queued'
      order by created_at asc
      limit 1;

    if next_borrowing_id is not null then
      -- Promove para borrowed e reinicia o relógio de 30 dias.
      update public.book_borrowings
        set status = 'borrowed',
            borrowed_at = now()
        where id = next_borrowing_id;

      -- Notifica a pessoa promovida.
      select title into the_book_title from public.books where id = new.book_id;

      insert into public.notifications (profile_id, type, title, message, link)
      values (
        next_profile_id,
        'book_available_for_you',
        'Sua vez! 📚',
        coalesce(the_book_title, 'O livro') ||
        ' está disponível agora. Pegue com quem acabou de devolver.',
        '/biblioteca/' || new.book_id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_borrowing_returned on public.book_borrowings;
create trigger on_borrowing_returned
  after update on public.book_borrowings
  for each row execute function public.promote_next_in_queue();
