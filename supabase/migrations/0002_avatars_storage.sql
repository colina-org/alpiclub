-- =====================================================================
-- Alpiclub — Avatars Storage bucket + RLS policies
-- Public bucket so avatar URLs work without signed URLs.
-- Write/update/delete: only the owner (path starts with their auth.uid)
-- or admins (via public.is_admin()).
-- Paste this into Supabase Studio → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Bucket
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 2. Policies on storage.objects (scoped to bucket = 'avatars')
-- ---------------------------------------------------------------------

-- Public read: anyone can see avatars (consistent with bucket being public).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Insert: user can upload only inside their own folder, OR admins can upload anywhere.
drop policy if exists "avatars_owner_or_admin_insert" on storage.objects;
create policy "avatars_owner_or_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- Update: same rule.
drop policy if exists "avatars_owner_or_admin_update" on storage.objects;
create policy "avatars_owner_or_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- Delete: same rule.
drop policy if exists "avatars_owner_or_admin_delete" on storage.objects;
create policy "avatars_owner_or_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
