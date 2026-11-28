-- ============================================================================
-- Mohsin FutureTech — 0004 Storage buckets and policies
-- ----------------------------------------------------------------------------
--   product-images   PUBLIC read. Only admins upload/replace/delete.
--   payment-receipts PRIVATE. Uploaded only by the server (service role)
--                    after it has verified the order; path is
--                    <order_id>/<random>.<ext>. Only admins can read (the
--                    admin UI uses short-lived signed URLs).
-- Both buckets accept JPG/PNG/WebP up to 5 MB, enforced by Storage itself.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('payment-receipts', 'payment-receipts', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- product-images ---------------------------------------------------------------
create policy "product-images: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');

create policy "product-images: admin insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "product-images: admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "product-images: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

-- payment-receipts -------------------------------------------------------------
-- No insert policy for anon/authenticated: customers cannot upload directly.
create policy "payment-receipts: admin read"
  on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts' and (select public.is_admin()));

create policy "payment-receipts: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'payment-receipts' and (select public.is_admin()));
