-- =====================================================================
-- Alpiclub — Imagem em conquistas
-- Adiciona image_url em achievements + bucket de Storage com RLS.
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Coluna image_url em achievements
-- ---------------------------------------------------------------------
alter table public.achievements
  add column if not exists image_url text;

comment on column public.achievements.image_url is
  'URL pública da imagem da conquista (Supabase Storage). Opcional.';

-- ---------------------------------------------------------------------
-- 2. Bucket achievement_images (público, 3MB max, jpg/png/webp)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'achievement_images',
  'achievement_images',
  true,
  3 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 3. Storage RLS — leitura pública, escrita do autor (granter) ou admin.
--    Path = '<granter-id>/<filename>' — primeiro segmento é a auth.uid().
-- ---------------------------------------------------------------------
drop policy if exists "achievement_images_public_read" on storage.objects;
create policy "achievement_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'achievement_images');

drop policy if exists "achievement_images_owner_or_admin_insert" on storage.objects;
create policy "achievement_images_owner_or_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'achievement_images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "achievement_images_owner_or_admin_update" on storage.objects;
create policy "achievement_images_owner_or_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'achievement_images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "achievement_images_owner_or_admin_delete" on storage.objects;
create policy "achievement_images_owner_or_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'achievement_images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
