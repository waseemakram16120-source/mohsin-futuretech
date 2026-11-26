-- ============================================================================
-- Mohsin FutureTech — Supabase Storage Buckets & Policies (Step 1)
-- Run AFTER supabase/schema.sql and supabase/policies.sql in the
-- Supabase Dashboard -> SQL Editor.
-- ----------------------------------------------------------------------------
-- Buckets:
--   * product-images   — PUBLIC. Product photos served directly to shoppers.
--                        Only admins may upload / update / delete.
--   * payment-receipts — PRIVATE. EasyPaisa / JazzCash payment screenshots.
--                        Customers upload into their own folder only:
--                          payment-receipts/<user_id>/<order_id>/<file>
--                        Customers read only their own receipts; admins read all.
-- Safe to re-run: bucket insert uses ON CONFLICT, policies are dropped first.
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('payment-receipts', 'payment-receipts', false)
on conflict (id) do update set public = excluded.public;

-- ----------------------------------------------------------------------------
-- product-images
-- ----------------------------------------------------------------------------
drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and public.is_admin()
  );

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- ----------------------------------------------------------------------------
-- payment-receipts (private; path convention enforces ownership)
-- ----------------------------------------------------------------------------
drop policy if exists "Customers can upload own receipts" on storage.objects;
create policy "Customers can upload own receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Customers can view own receipts" on storage.objects;
create policy "Customers can view own receipts"
  on storage.objects for select
  using (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Admins can view receipts" on storage.objects;
create policy "Admins can view receipts"
  on storage.objects for select
  using (bucket_id = 'payment-receipts' and public.is_admin());

drop policy if exists "Admins can delete receipts" on storage.objects;
create policy "Admins can delete receipts"
  on storage.objects for delete
  using (bucket_id = 'payment-receipts' and public.is_admin());
