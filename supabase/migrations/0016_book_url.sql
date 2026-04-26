-- =====================================================================
-- Alpiclub — Link do livro
-- Adiciona url em books (link pra Amazon, Goodreads, editora, etc.)
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

alter table public.books
  add column if not exists url text;

comment on column public.books.url is
  'Link externo do livro (Amazon, Goodreads, editora). Opcional.';
