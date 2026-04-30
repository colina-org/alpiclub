-- =====================================================================
-- Alpiclub — Alpicoins: campo de anexo no pedido de coins
-- Suporta URL externa ou upload para o bucket alpicoins-attachments.
-- =====================================================================

-- Coluna no pedido de earn
alter table public.alpicoins_earn_requests
  add column if not exists attachment_url text null;

-- Bucket de anexos (público — URLs não são adivinháveis)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'alpicoins-attachments',
  'alpicoins-attachments',
  true,
  10 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública (bucket é público)
drop policy if exists "alpicoins_attachments_public_read" on storage.objects;
create policy "alpicoins_attachments_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'alpicoins-attachments');

-- Upload: apenas dentro da pasta do próprio usuário
drop policy if exists "alpicoins_attachments_owner_insert" on storage.objects;
create policy "alpicoins_attachments_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'alpicoins-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Exclusão: próprio usuário ou admin
drop policy if exists "alpicoins_attachments_owner_or_admin_delete" on storage.objects;
create policy "alpicoins_attachments_owner_or_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'alpicoins-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
