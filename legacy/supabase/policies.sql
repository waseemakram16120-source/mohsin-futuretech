-- ============================================================================
-- Mohsin FutureTech — Row Level Security Policies (Step 1)
-- Run AFTER supabase/schema.sql in the Supabase Dashboard -> SQL Editor.
-- ----------------------------------------------------------------------------
-- Rules (from the proposal):
--   * Anyone can read ACTIVE products, variants and categories.
--   * Customers can create/read their OWN orders, payments, addresses, wishlist.
--   * Admins (profiles.role = 'admin', see public.is_admin() in schema.sql)
--     have full access to every table.
--   * Customers CANNOT change their own role or any order/payment status —
--     the update policies below only allow role = 'customer' on self-updates.
-- Safe to re-run: every policy is dropped first.
-- ============================================================================

alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.profiles         enable row level security;
alter table public.addresses        enable row level security;
alter table public.coupons          enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.payments         enable row level security;
alter table public.wishlist         enable row level security;

-- ----------------------------------------------------------------------------
-- categories
-- ----------------------------------------------------------------------------
drop policy if exists "Public can view active categories" on public.categories;
create policy "Public can view active categories"
  on public.categories for select using (is_active = true);

drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories"
  on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
  on public.products for select using (is_active = true);

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
  on public.products for all
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- product_variants
-- ----------------------------------------------------------------------------
drop policy if exists "Public can view active variants" on public.product_variants;
create policy "Public can view active variants"
  on public.product_variants for select using (is_active = true);

drop policy if exists "Admins can manage variants" on public.product_variants;
create policy "Admins can manage variants"
  on public.product_variants for all
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  -- A customer may only ever save role = 'customer' (no self-promotion).
  with check (auth.uid() = id and role = 'customer');

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles"
  on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- addresses
-- ----------------------------------------------------------------------------
drop policy if exists "Users can manage own addresses" on public.addresses;
create policy "Users can manage own addresses"
  on public.addresses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Admins can manage addresses" on public.addresses;
create policy "Admins can manage addresses"
  on public.addresses for all
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- coupons — customers can only see currently valid, active coupons
-- ----------------------------------------------------------------------------
drop policy if exists "Public can view valid coupons" on public.coupons;
create policy "Public can view valid coupons"
  on public.coupons for select using (
    is_active = true
    and (valid_from is null or valid_from <= now())
    and (valid_until is null or valid_until >= now())
  );

drop policy if exists "Admins can manage coupons" on public.coupons;
create policy "Admins can manage coupons"
  on public.coupons for all
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- orders
-- ----------------------------------------------------------------------------
drop policy if exists "Customers can view own orders" on public.orders;
create policy "Customers can view own orders"
  on public.orders for select using (auth.uid() = user_id);

drop policy if exists "Customers can create own orders" on public.orders;
create policy "Customers can create own orders"
  on public.orders for insert with check (auth.uid() = user_id);

drop policy if exists "Admins can manage orders" on public.orders;
create policy "Admins can manage orders"
  on public.orders for all
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- order_items — access follows ownership of the parent order
-- ----------------------------------------------------------------------------
drop policy if exists "Customers can view own order items" on public.order_items;
create policy "Customers can view own order items"
  on public.order_items for select using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id and orders.user_id = auth.uid()
    )
  );

drop policy if exists "Customers can create own order items" on public.order_items;
create policy "Customers can create own order items"
  on public.order_items for insert with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id and orders.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can manage order items" on public.order_items;
create policy "Admins can manage order items"
  on public.order_items for all
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- payments — customers submit/view their own; only admins review (update)
-- ----------------------------------------------------------------------------
drop policy if exists "Customers can view own payments" on public.payments;
create policy "Customers can view own payments"
  on public.payments for select using (
    exists (
      select 1 from public.orders
      where orders.id = payments.order_id and orders.user_id = auth.uid()
    )
  );

drop policy if exists "Customers can submit own payments" on public.payments;
create policy "Customers can submit own payments"
  on public.payments for insert with check (
    exists (
      select 1 from public.orders
      where orders.id = payments.order_id and orders.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can manage payments" on public.payments;
create policy "Admins can manage payments"
  on public.payments for all
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- wishlist
-- ----------------------------------------------------------------------------
drop policy if exists "Users can manage own wishlist" on public.wishlist;
create policy "Users can manage own wishlist"
  on public.wishlist for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Admins can view wishlist" on public.wishlist;
create policy "Admins can view wishlist"
  on public.wishlist for select using (public.is_admin());
