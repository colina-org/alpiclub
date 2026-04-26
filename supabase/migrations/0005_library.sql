-- =====================================================================
-- Alpiclub — Library (books + book_reads)
-- Shared catalog. Each profile records its own read status / rating / review.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum: read status
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'book_read_status') then
    create type public.book_read_status as enum ('wishlist', 'reading', 'read');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. books — shared catalog
-- ---------------------------------------------------------------------
create table public.books (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  author       text not null,
  cover_url    text,
  description  text,
  category     text,
  added_by_id  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint books_title_not_blank  check (length(trim(title))  > 0),
  constraint books_author_not_blank check (length(trim(author)) > 0)
);

comment on table public.books is 'Catálogo compartilhado de livros da Colina Tech';

create index books_title_idx     on public.books (title);
create index books_author_idx    on public.books (author);
create index books_category_idx  on public.books (category);
create index books_added_by_idx  on public.books (added_by_id);

create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. book_reads — per-person status / rating / review
-- ---------------------------------------------------------------------
create table public.book_reads (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  book_id      uuid not null references public.books(id) on delete cascade,
  status       public.book_read_status not null default 'wishlist',
  rating       int check (rating between 1 and 5),
  review       text,
  finished_at  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (profile_id, book_id)
);

comment on table public.book_reads is 'Status, nota e resenha individual de cada pessoa por livro';

create index book_reads_profile_idx on public.book_reads (profile_id);
create index book_reads_book_idx    on public.book_reads (book_id);
create index book_reads_status_idx  on public.book_reads (status);

create trigger book_reads_set_updated_at
  before update on public.book_reads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.books      enable row level security;
alter table public.book_reads enable row level security;

-- books: anyone authenticated reads / inserts; only added_by or admin updates / deletes
create policy "books_select_authenticated"
  on public.books for select
  to authenticated
  using (true);

create policy "books_insert_authenticated"
  on public.books for insert
  to authenticated
  with check (added_by_id = auth.uid() or added_by_id is null);

create policy "books_update_own_or_admin"
  on public.books for update
  to authenticated
  using (added_by_id = auth.uid() or public.is_admin())
  with check (added_by_id = auth.uid() or public.is_admin());

create policy "books_delete_own_or_admin"
  on public.books for delete
  to authenticated
  using (added_by_id = auth.uid() or public.is_admin());

-- book_reads: read all (so we can show team reviews), write only own
create policy "book_reads_select_authenticated"
  on public.book_reads for select
  to authenticated
  using (true);

create policy "book_reads_insert_self"
  on public.book_reads for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "book_reads_update_self"
  on public.book_reads for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "book_reads_delete_self"
  on public.book_reads for delete
  to authenticated
  using (profile_id = auth.uid());
