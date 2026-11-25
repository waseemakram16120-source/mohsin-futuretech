-- ============================================================================
-- Mohsin FutureTech — E-Commerce Database Schema (Step 1)
-- Stack: Next.js (App Router) + Node.js API routes + Supabase (Postgres)
-- ----------------------------------------------------------------------------
-- Run order in the Supabase Dashboard -> SQL Editor (fresh project):
--   1) supabase/schema.sql    (this file — tables, enums, helpers, triggers)
--   2) supabase/policies.sql  (Row Level Security)
--   3) supabase/storage.sql   (buckets + storage policies)
--   4) supabase/seed.sql      (sample categories, products, coupon)
-- Safe to re-run: tables/types use IF NOT EXISTS / ON CONFLICT guards.
-- No real credentials or secrets are stored in this file.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
-- payment_status display labels (see src/lib/constants.ts):
--   pending_verification = "Pending Verification"
--   approved             = "Approved"
--   rejected             = "Rejected"
--   due                  = "Due on Delivery" (COD)
--   paid                 = "Paid"
do $$ begin
  create type public.user_role as enum ('customer', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cod', 'easypaisa', 'jazzcash');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'pending_verification', 'approved', 'rejected', 'due', 'paid'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending', 'confirmed', 'processing', 'shipped',
    'delivered', 'cancelled', 'returned'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.discount_type as enum ('percentage', 'fixed');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Helper functions
-- ----------------------------------------------------------------------------

-- Keeps updated_at fresh on every row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- True when the signed-in user has the admin role.
-- Used by RLS policies in policies.sql and storage.sql.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Order numbers look like: MF-20261124-00001
create sequence if not exists public.order_number_seq;

create or replace function public.generate_order_number()
returns text
language sql
as $$
  select 'MF-' || to_char(now(), 'YYYYMMDD') || '-'
    || lpad(nextval('public.order_number_seq')::text, 5, '0');
$$;

create or replace function public.assign_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.generate_order_number();
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- categories
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  image_url   text,
  parent_id   uuid references public.categories (id) on delete set null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid references public.categories (id) on delete set null,
  name             text not null,
  slug             text not null unique,
  description      text,
  base_price       numeric(12, 2) not null check (base_price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price >= 0),
  image_url        text,
  is_featured      boolean not null default false,
  is_new_arrival   boolean not null default false,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- product_variants — one row per size/color combination, with its own SKU/stock
-- ----------------------------------------------------------------------------
create table if not exists public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  sku            text not null unique,
  size           text not null,
  color          text not null,
  price_override numeric(12, 2) check (price_override is null or price_override >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (product_id, size, color)
);

-- ----------------------------------------------------------------------------
-- profiles — one row per auth user; role drives admin access (see is_admin())
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  phone      text,
  role       public.user_role not null default 'customer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a user signs up (Supabase Auth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- addresses — saved delivery addresses per customer
-- ----------------------------------------------------------------------------
create table if not exists public.addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  label         text not null default 'Home',
  full_name     text not null,
  phone         text not null,
  address_line1 text not null,
  address_line2 text,
  city          text not null,
  province      text,
  postal_code   text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- coupons
-- ----------------------------------------------------------------------------
create table if not exists public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  discount_type    public.discount_type not null default 'percentage',
  discount_value   numeric(12, 2) not null check (discount_value >= 0),
  min_order_amount numeric(12, 2) not null default 0 check (min_order_amount >= 0),
  max_uses         integer check (max_uses is null or max_uses > 0),
  used_count       integer not null default 0 check (used_count >= 0),
  valid_from       timestamptz,
  valid_until      timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- orders
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique,
  user_id          uuid references public.profiles (id) on delete set null,
  delivery_name    text not null,
  delivery_phone   text not null,
  delivery_address text not null,
  city             text not null,
  province         text,
  postal_code      text,
  subtotal         numeric(12, 2) not null default 0 check (subtotal >= 0),
  delivery_charges numeric(12, 2) not null default 0 check (delivery_charges >= 0),
  discount_amount  numeric(12, 2) not null default 0 check (discount_amount >= 0),
  coupon_code      text,
  total_amount     numeric(12, 2) not null default 0 check (total_amount >= 0),
  payment_method   public.payment_method not null,
  status           public.order_status not null default 'pending',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists assign_order_number on public.orders;
create trigger assign_order_number
  before insert on public.orders
  for each row execute function public.assign_order_number();

-- ----------------------------------------------------------------------------
-- order_items — product/variant snapshots are stored so history survives edits
-- ----------------------------------------------------------------------------
create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  variant_id    uuid references public.product_variants (id) on delete set null,
  product_name  text not null,
  variant_label text,
  sku           text,
  unit_price    numeric(12, 2) not null check (unit_price >= 0),
  quantity      integer not null check (quantity > 0),
  line_total    numeric(12, 2) generated always as (unit_price * quantity) stored,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- payments — one row per payment submission (EasyPaisa/JazzCash evidence or COD)
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  payment_method public.payment_method not null,
  transaction_id text,
  amount         numeric(12, 2) not null check (amount >= 0),
  receipt_url    text,
  status         public.payment_status not null default 'pending_verification',
  reviewed_by    uuid references public.profiles (id) on delete set null,
  review_note    text,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- wishlist
-- ----------------------------------------------------------------------------
create table if not exists public.wishlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
drop trigger if exists set_updated_at on public.categories;
create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.product_variants;
create trigger set_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.addresses;
create trigger set_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.coupons;
create trigger set_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.orders;
create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.payments;
create trigger set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_products_category_id   on public.products (category_id);
create index if not exists idx_products_slug          on public.products (slug);
create index if not exists idx_products_is_active     on public.products (is_active);
create index if not exists idx_products_featured      on public.products (is_featured) where is_featured;
create index if not exists idx_variants_product_id    on public.product_variants (product_id);
create index if not exists idx_variants_stock         on public.product_variants (stock_quantity);
create index if not exists idx_addresses_user_id      on public.addresses (user_id);
create index if not exists idx_coupons_code           on public.coupons (code);
create index if not exists idx_orders_user_id         on public.orders (user_id);
create index if not exists idx_orders_status          on public.orders (status);
create index if not exists idx_orders_number          on public.orders (order_number);
create index if not exists idx_orders_created_at      on public.orders (created_at desc);
create index if not exists idx_order_items_order_id   on public.order_items (order_id);
create index if not exists idx_payments_order_id      on public.payments (order_id);
create index if not exists idx_payments_status        on public.payments (status);
create index if not exists idx_wishlist_user_id       on public.wishlist (user_id);
