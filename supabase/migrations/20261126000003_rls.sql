-- ============================================================================
-- Mohsin FutureTech — 0003 Row Level Security + table privileges
-- ----------------------------------------------------------------------------
-- Principles
--   * RLS is enabled on EVERY table in public.
--   * Shoppers (anon) read only the active catalogue and store settings.
--   * Customers read their own profile, addresses, wishlist, orders,
--     order items, status history and payments. They NEVER insert or update
--     orders/payments directly: that only happens through the functions in
--     0002 (place_order / submit_payment_evidence), called by the server.
--   * Admins (profiles.role = 'admin') read everything; their writes to
--     orders, payments and stock go through admin functions so the workflow
--     and audit trail cannot be skipped.
--   * Table privileges are narrowed too (defence in depth): a missing policy
--     would still be blocked by a missing GRANT.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'store_settings', 'addresses', 'categories', 'products',
    'product_images', 'product_variants', 'coupons', 'orders', 'order_items',
    'order_status_history', 'payments', 'inventory_movements',
    'coupon_redemptions', 'wishlist'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    -- Start from nothing; grant back only what each role needs below.
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;   -- never role/email
grant update (role) on public.profiles to authenticated;               -- RLS: admins only (below)

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: admin read all" on public.profiles
  for select to authenticated using ((select public.is_admin()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy "profiles: admin update" on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- A non-admin can never change a role or email (the role column grant is
-- shared with "update own", so this trigger is the real guard).
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Client sessions (anon/authenticated) may change a role only as admin.
  -- The SQL editor / service role has no client role and is allowed.
  if coalesce((select auth.role()), '') in ('anon', 'authenticated') then
    if new.role is distinct from old.role and not public.is_admin() then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if new.email is distinct from old.email then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ----------------------------------------------------------------------------
-- store_settings — public read (wallet accounts are shown at checkout)
-- ----------------------------------------------------------------------------
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;

create policy "settings: public read" on public.store_settings
  for select to anon, authenticated using (true);
create policy "settings: admin update" on public.store_settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ----------------------------------------------------------------------------
-- addresses
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on public.addresses to authenticated;

create policy "addresses: own" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "addresses: admin read" on public.addresses
  for select to authenticated using ((select public.is_admin()));

-- ----------------------------------------------------------------------------
-- Catalogue: categories, products, product_images, product_variants
-- ----------------------------------------------------------------------------
grant select on public.categories, public.products, public.product_images,
                public.product_variants to anon, authenticated;
grant insert, update, delete on public.categories, public.products,
                public.product_images to authenticated;
-- Variant stock changes only through adjust_stock / orders (audited).
grant insert on public.product_variants to authenticated;
grant update (sku, size, color, color_hex, price_override, sort_order, is_active)
  on public.product_variants to authenticated;

create policy "categories: public read active" on public.categories
  for select to anon, authenticated using (is_active);
create policy "categories: admin all" on public.categories
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "products: public read active" on public.products
  for select to anon, authenticated using (is_active);
create policy "products: admin all" on public.products
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "product_images: public read" on public.product_images
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );
create policy "product_images: admin all" on public.product_images
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "variants: public read active" on public.product_variants
  for select to anon, authenticated using (
    is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );
create policy "variants: admin read" on public.product_variants
  for select to authenticated using ((select public.is_admin()));
create policy "variants: admin insert" on public.product_variants
  for insert to authenticated with check ((select public.is_admin()));
create policy "variants: admin update" on public.product_variants
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ----------------------------------------------------------------------------
-- coupons — admin only (customers validate a code via validate_coupon()).
-- ----------------------------------------------------------------------------
grant select, insert, delete on public.coupons to authenticated;
grant update (code, description, discount_type, discount_value, min_order_amount,
              max_uses, valid_from, valid_until, is_active)
  on public.coupons to authenticated;

create policy "coupons: admin all" on public.coupons
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.coupon_redemptions to authenticated;
create policy "coupon_redemptions: admin read" on public.coupon_redemptions
  for select to authenticated using ((select public.is_admin()));

-- ----------------------------------------------------------------------------
-- Orders and everything under them — read-only through RLS.
-- ----------------------------------------------------------------------------
grant select on public.orders, public.order_items, public.order_status_history,
                public.payments to authenticated;

create policy "orders: read own" on public.orders
  for select to authenticated using (user_id = (select auth.uid()));
create policy "orders: admin read" on public.orders
  for select to authenticated using ((select public.is_admin()));

create policy "order_items: read own" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o
             where o.id = order_id and o.user_id = (select auth.uid()))
  );
create policy "order_items: admin read" on public.order_items
  for select to authenticated using ((select public.is_admin()));

create policy "order_status_history: read own" on public.order_status_history
  for select to authenticated using (
    exists (select 1 from public.orders o
             where o.id = order_id and o.user_id = (select auth.uid()))
  );
create policy "order_status_history: admin read" on public.order_status_history
  for select to authenticated using ((select public.is_admin()));

create policy "payments: read own" on public.payments
  for select to authenticated using (
    exists (select 1 from public.orders o
             where o.id = order_id and o.user_id = (select auth.uid()))
  );
create policy "payments: admin read" on public.payments
  for select to authenticated using ((select public.is_admin()));

-- ----------------------------------------------------------------------------
-- inventory_movements — admin read only
-- ----------------------------------------------------------------------------
grant select on public.inventory_movements to authenticated;
create policy "inventory_movements: admin read" on public.inventory_movements
  for select to authenticated using ((select public.is_admin()));

-- ----------------------------------------------------------------------------
-- wishlist
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on public.wishlist to authenticated;
create policy "wishlist: own" on public.wishlist
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Sequences: nobody but the definer functions needs the order sequence.
revoke all on sequence public.order_number_seq from anon, authenticated;
