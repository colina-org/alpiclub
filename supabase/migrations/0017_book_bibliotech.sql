-- =====================================================================
-- Alpiclub — Disponibilidade na Bibliotech
-- Marca livros que estão fisicamente disponíveis na empresa
-- (podem ser "alugados" / reservados pelos colaboradores).
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

alter table public.books
  add column if not exists available_at_bibliotech boolean not null default false;

comment on column public.books.available_at_bibliotech is
  'TRUE = livro disponível fisicamente na Bibliotech (biblioteca da empresa).';

create index if not exists books_bibliotech_idx
  on public.books (available_at_bibliotech)
  where available_at_bibliotech = true;
