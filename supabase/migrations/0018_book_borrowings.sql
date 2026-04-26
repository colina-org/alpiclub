-- =====================================================================
-- Alpiclub — Empréstimos de livros da Bibliotech
-- Pega/devolve livros físicos. 1 pessoa por vez via unique partial index.
-- Histórico preservado (status='returned' permanece como registro).
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'book_borrow_status') then
    create type public.book_borrow_status as enum ('borrowed', 'returned');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Tabela
-- ---------------------------------------------------------------------
create table public.book_borrowings (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  status        public.book_borrow_status not null default 'borrowed',
  borrowed_at   timestamptz not null default now(),
  returned_at   timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.book_borrowings is
  'Histórico de empréstimos físicos da Bibliotech. Apenas 1 borrowed por livro de cada vez.';

create index book_borrowings_book_idx     on public.book_borrowings (book_id);
create index book_borrowings_profile_idx  on public.book_borrowings (profile_id);
create index book_borrowings_status_idx   on public.book_borrowings (status);
create index book_borrowings_borrowed_at_idx
  on public.book_borrowings (borrowed_at desc);

-- Garante que há no máximo UM 'borrowed' por livro a qualquer momento.
create unique index book_borrowings_one_active_per_book
  on public.book_borrowings (book_id)
  where status = 'borrowed';

create trigger book_borrowings_set_updated_at
  before update on public.book_borrowings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
alter table public.book_borrowings enable row level security;

-- Leitura: qualquer autenticado (todos veem quem tem o quê).
create policy "book_borrowings_select_authenticated"
  on public.book_borrowings for select
  to authenticated
  using (true);

-- Insert: só como você mesmo (profile_id = auth.uid()).
-- O livro precisa estar marcado como available_at_bibliotech.
-- A unicidade garante que ninguém mais tem o livro no momento.
create policy "book_borrowings_insert_self"
  on public.book_borrowings for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.books b
      where b.id = book_id
        and b.available_at_bibliotech = true
    )
  );

-- Update: o próprio dono (para marcar como devolvido) ou admin.
create policy "book_borrowings_update_own_or_admin"
  on public.book_borrowings for update
  to authenticated
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- Delete: só admin (se precisar limpar registro errado). Em geral histórico
-- não é apagado.
create policy "book_borrowings_delete_admin"
  on public.book_borrowings for delete
  to authenticated
  using (public.is_admin());
