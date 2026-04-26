-- =====================================================================
-- Alpiclub — Apelido + redes sociais no profile
-- Adiciona nickname (como a pessoa gosta de ser chamada) + 4 redes sociais.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

alter table public.profiles
  add column if not exists nickname      text,
  add column if not exists instagram_url text,
  add column if not exists linkedin_url  text,
  add column if not exists github_url    text,
  add column if not exists website_url   text;

comment on column public.profiles.nickname is
  'Apelido / como prefere ser chamado(a). Exibido entre parênteses ao lado do nome.';
