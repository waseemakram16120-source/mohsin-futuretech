-- ============================================================================
-- Mohsin FutureTech — 0001 schema: enums, tables, indexes, triggers
-- ----------------------------------------------------------------------------
-- Apply in order with the Supabase CLI (`supabase db push`) or by running
-- every file in supabase/migrations in the SQL Editor, then supabase/seed.sql.
-- Money is stored as numeric(12,2) in PKR.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- Enums (mirrored in src/lib/domain.ts)
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'admin');
create type public.audience as enum ('men', 'women', 'unisex');
create type public.order_status as enum (
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'
);
create type public.payment_method as enum ('cod', 'easypaisa', 'jazzcash', 'nayapay');
create type public.payment_status as enum (
  'awaiting_payment',      -- wallet order placed, no evidence submitted yet
  'pending_verification',  -- evidence submitted, waiting for admin review
  'approved',              -- admin verified the wallet payment
  'rejected',              -- admin rejected the evidence (customer may resubmit)
  'due',                   -- COD: cash expected at delivery
  'paid'                   -- admin recorded the money as received
);
create type public.discount_type as enum ('percentage', 'fixed');
create type public.stock_reason as enum ('initial', 'order', 'cancel', 'return', 'adjustment');

-- ----------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles — one row per auth user
-- ----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '' check (char_length(full_name) <= 120),
  phone      text check (phone is null or phone ~ '^03[0-9]{9}$'),
  role       public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- store_settings — single row, editable by admins (Admin → Settings)
-- ----------------------------------------------------------------------------
create table public.store_settings (
  id                  smallint primary key default 1 check (id = 1),
  store_name          text not null default 'Mohsin FutureTech',
  support_phone       text,
  support_email       text,
  whatsapp_number     text check (whatsapp_number is null or whatsapp_number ~ '^92[0-9]{10}$'),
  store_address       text,
  delivery_charge     numeric(12, 2) not null default 250 check (delivery_charge >= 0),
  free_delivery_min   numeric(12, 2) not null default 5000 check (free_delivery_min >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  easypaisa_account_name   text,
  easypaisa_account_number text,
  jazzcash_account_name    text,
  jazzcash_account_number  text,
  nayapay_account_name     text,
  nayapay_account_number   text,
  updated_at          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- addresses — saved delivery addresses
-- ----------------------------------------------------------------------------
create table public.addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  label         text not null default 'Home' check (char_length(label) between 1 and 40),
  full_name     text not null check (char_length(full_name) between 3 and 120),
  phone         text not null check (phone ~ '^03[0-9]{9}$'),
  address_line1 text not null check (char_length(address_line1) between 5 and 200),
  address_line2 text check (address_line2 is null or char_length(address_line2) <= 200),
  city          text not null check (char_length(city) between 2 and 80),
  province      text check (province is null or char_length(province) <= 80),
  postal_code   text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default_per_user
  on public.addresses (user_id) where is_default;

-- ----------------------------------------------------------------------------
-- categories — product types (jackets, jeans, ...). Men/Women is the
-- product `audience`, so one product can be filtered both ways.
-- ----------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (description is null or char_length(description) <= 500),
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
create table public.products (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid references public.categories (id) on delete set null,
  audience         public.audience not null default 'unisex',
  name             text not null check (char_length(name) between 2 and 120),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description      text not null default '' check (char_length(description) <= 5000),
  details          text[] not null default '{}',   -- bullet points: fabric, fit, care
  base_price       numeric(12, 2) not null check (base_price > 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price > base_price),
  is_active        boolean not null default true,
  is_featured      boolean not null default false,
  is_new_arrival   boolean not null default false,
  search_vector    tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create index products_audience_idx on public.products (audience);
create index products_active_created_idx on public.products (is_active, created_at desc);
create index products_search_idx on public.products using gin (search_vector);

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url        text not null check (char_length(url) between 1 and 1000),
  alt        text not null default '' check (char_length(alt) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

-- Variants are never hard-deleted by the app (set is_active = false) so
-- carts, wishlists and order history keep a valid reference.
create table public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  sku            text not null unique check (sku ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  size           text not null check (char_length(size) between 1 and 20),
  color          text not null check (char_length(color) between 1 and 40),
  color_hex      text not null default '#6B7280' check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  price_override numeric(12, 2) check (price_override is null or price_override > 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (product_id, size, color)
);
create index product_variants_product_idx on public.product_variants (product_id);

-- ----------------------------------------------------------------------------
-- coupons
-- ----------------------------------------------------------------------------
create table public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[A-Z0-9]{3,30}$'),
  description      text,
  discount_type    public.discount_type not null,
  discount_value   numeric(12, 2) not null check (discount_value > 0),
  min_order_amount numeric(12, 2) not null default 0 check (min_order_amount >= 0),
  max_uses         integer check (max_uses is null or max_uses > 0),
  used_count       integer not null default 0 check (used_count >= 0),
  valid_from       timestamptz,
  valid_until      timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (discount_type <> 'percentage' or discount_value <= 90),
  check (valid_until is null or valid_from is null or valid_until > valid_from)
);

-- ----------------------------------------------------------------------------
-- orders
-- ----------------------------------------------------------------------------
create sequence public.order_number_seq;

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique,
  user_id          uuid references public.profiles (id) on delete set null,
  customer_email   text check (customer_email is null or customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  delivery_name    text not null check (char_length(delivery_name) between 3 and 120),
  delivery_phone   text not null check (delivery_phone ~ '^03[0-9]{9}$'),
  delivery_address text not null check (char_length(delivery_address) between 10 and 400),
  city             text not null check (char_length(city) between 2 and 80),
  province         text,
  postal_code      text,
  notes            text check (notes is null or char_length(notes) <= 500),
  subtotal         numeric(12, 2) not null check (subtotal >= 0),
  delivery_charge  numeric(12, 2) not null check (delivery_charge >= 0),
  discount_amount  numeric(12, 2) not null default 0 check (discount_amount >= 0),
  coupon_code      text,
  total_amount     numeric(12, 2) not null check (total_amount >= 0),
  payment_method   public.payment_method not null,
  payment_status   public.payment_status not null,
  status           public.order_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (total_amount = subtotal - discount_amount + delivery_charge),
  check (discount_amount <= subtotal)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_created_idx on public.orders (created_at desc);

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  variant_id    uuid references public.product_variants (id) on delete set null,
  product_name  text not null,
  product_slug  text,
  sku           text not null,
  size          text not null,
  color         text not null,
  image_url     text,
  unit_price    numeric(12, 2) not null check (unit_price >= 0),
  quantity      integer not null check (quantity > 0),
  line_total    numeric(12, 2) generated always as (unit_price * quantity) stored,
  created_at    timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_variant_idx on public.order_items (variant_id);

create table public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  note        text check (note is null or char_length(note) <= 500),
  created_at  timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- ----------------------------------------------------------------------------
-- payments — the order's payment record(s). place_order creates the first
-- row; the first evidence submission fills it in; a resubmission after a
-- rejection adds a new row so rejected evidence stays on file. The row with
-- the highest seq is the current one and always matches orders.payment_status.
-- ----------------------------------------------------------------------------
create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  seq            bigint generated always as identity unique,  -- strict order of records
  order_id       uuid not null references public.orders (id) on delete cascade,
  method         public.payment_method not null,
  amount         numeric(12, 2) not null check (amount >= 0),
  status         public.payment_status not null,
  transaction_id text check (transaction_id is null or transaction_id ~ '^[A-Za-z0-9-]{6,40}$'),
  receipt_path   text,
  customer_note  text check (customer_note is null or char_length(customer_note) <= 500),
  reviewed_by    uuid references public.profiles (id) on delete set null,
  review_note    text check (review_note is null or char_length(review_note) <= 500),
  reviewed_at    timestamptz,
  submitted_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id, seq desc);
create index payments_status_idx on public.payments (status, created_at desc);
-- A wallet transaction ID can back only one live (non-rejected) submission.
create unique index payments_live_transaction_unique
  on public.payments (method, upper(transaction_id))
  where transaction_id is not null and status in ('pending_verification', 'approved', 'paid');

-- ----------------------------------------------------------------------------
-- inventory_movements — audit log of every stock change
-- ----------------------------------------------------------------------------
create table public.inventory_movements (
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  change     integer not null check (change <> 0),
  reason     public.stock_reason not null,
  order_id   uuid references public.orders (id) on delete set null,
  actor_id   uuid references public.profiles (id) on delete set null,
  note       text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);

create table public.coupon_redemptions (
  id         uuid primary key default gen_random_uuid(),
  coupon_id  uuid not null references public.coupons (id) on delete cascade,
  order_id   uuid not null unique references public.orders (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- wishlist
-- ----------------------------------------------------------------------------
create table public.wishlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'store_settings', 'addresses', 'categories', 'products',
    'product_variants', 'coupons', 'orders', 'payments'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- The single settings row must always exist (place_order reads it).
insert into public.store_settings (id) values (1) on conflict (id) do nothing;
