-- ============================================================================
-- Mohsin FutureTech — 0002 functions
-- ----------------------------------------------------------------------------
-- Every write that touches money or stock happens inside one of these
-- functions, in a single transaction, with row locks. Errors are raised with
-- a short machine-readable code as the message (e.g. 'out_of_stock'); the
-- API layer maps codes to friendly text.
--
-- SECURITY DEFINER functions always set search_path = '' and use fully
-- qualified names. EXECUTE is revoked from everyone and granted explicitly
-- at the bottom of this file.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------

-- Normalise a Pakistani mobile number to 03XXXXXXXXX, or NULL if invalid.
-- Accepts 03001234567, 0300-1234567, +92 300 1234567, 923001234567.
create or replace function public.normalize_pk_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^03[0-9]{9}$' then d
    when d ~ '^923[0-9]{9}$' then '0' || substr(d, 3)
    when d ~ '^3[0-9]{9}$' then '0' || d
    else null
  end
  from (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as d) s;
$$;

-- True when the current user has the admin role. Used by RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- MF-YYMMDD-00001 (Pakistan date + global sequence).
create or replace function public.generate_order_number()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n bigint := nextval('public.order_number_seq');
begin
  return 'MF-' || to_char(now() at time zone 'Asia/Karachi', 'YYMMDD') || '-'
    || lpad(n::text, greatest(5, length(n::text)), '0');
end;
$$;

-- ----------------------------------------------------------------------------
-- Auth: create a profile for every new user. The role is always 'customer';
-- admins are promoted manually (see docs/ADMIN_SETUP in Phase 10).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Log the opening stock of a new variant.
create or replace function public.log_initial_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stock_quantity > 0 then
    insert into public.inventory_movements (variant_id, change, reason, actor_id, note)
    values (new.id, new.stock_quantity, 'initial', (select auth.uid()), 'Opening stock');
  end if;
  return new;
end;
$$;

create trigger log_initial_stock
  after insert on public.product_variants
  for each row execute function public.log_initial_stock();

-- ----------------------------------------------------------------------------
-- Coupons
-- ----------------------------------------------------------------------------

-- Discount for a coupon row and subtotal. Percentages round to whole rupees.
create or replace function public.coupon_discount(
  p_type public.discount_type,
  p_value numeric,
  p_subtotal numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'percentage' then least(round(p_subtotal * p_value / 100), p_subtotal)
    else least(p_value, p_subtotal)
  end;
$$;

-- Returns NULL when the coupon applies, else an error code.
create or replace function public.coupon_problem(c public.coupons, p_subtotal numeric)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when not c.is_active then 'coupon_invalid'
    when c.valid_from is not null and c.valid_from > now() then 'coupon_not_started'
    when c.valid_until is not null and c.valid_until < now() then 'coupon_expired'
    when c.max_uses is not null and c.used_count >= c.max_uses then 'coupon_used_up'
    when p_subtotal < c.min_order_amount then 'coupon_min_order'
    else null
  end;
$$;

-- Preview a coupon for the cart. Safe for guests: reveals nothing about
-- codes the caller does not already know.
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.coupons;
  v_problem text;
begin
  select * into c from public.coupons where code = upper(btrim(coalesce(p_code, '')));
  if not found then
    return jsonb_build_object('valid', false, 'error', 'coupon_invalid');
  end if;
  v_problem := public.coupon_problem(c, coalesce(p_subtotal, 0));
  if v_problem is not null then
    return jsonb_build_object(
      'valid', false, 'error', v_problem, 'min_order_amount', c.min_order_amount
    );
  end if;
  return jsonb_build_object(
    'valid', true,
    'code', c.code,
    'discount_type', c.discount_type,
    'discount_value', c.discount_value,
    'discount', public.coupon_discount(c.discount_type, c.discount_value, p_subtotal)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- place_order — the only way an order is created.
-- Called by the server (service role) after Zod validation. p_user_id is the
-- verified session user or NULL for a guest.
--   p_customer: { name, phone, email?, address, city, province?, postal_code?, notes? }
--   p_items:    [ { variant_id, quantity }, ... ]
-- ----------------------------------------------------------------------------
create or replace function public.place_order(
  p_user_id uuid,
  p_customer jsonb,
  p_items jsonb,
  p_payment_method public.payment_method,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_qty constant integer := 10;
  v_settings public.store_settings;
  v_el jsonb;
  v_req record;
  v_row record;
  v_lines jsonb := '[]'::jsonb;
  v_price numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_delivery numeric(12, 2);
  v_total numeric(12, 2);
  v_coupon public.coupons;
  v_coupon_code text := nullif(upper(btrim(coalesce(p_coupon_code, ''))), '');
  v_problem text;
  v_phone text;
  v_payment_status public.payment_status;
  v_order public.orders;
begin
  -- Cart shape -----------------------------------------------------------
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'cart_empty';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'too_many_items';
  end if;
  for v_el in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_el) <> 'object'
       or coalesce(v_el ->> 'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(v_el -> 'quantity') <> 'number'
       or (v_el ->> 'quantity') !~ '^[0-9]+$' then
      raise exception 'invalid_item';
    end if;
  end loop;

  -- Customer -------------------------------------------------------------
  v_phone := public.normalize_pk_phone(p_customer ->> 'phone');
  if v_phone is null then
    raise exception 'invalid_phone';
  end if;
  if char_length(btrim(coalesce(p_customer ->> 'name', ''))) < 3
     or char_length(btrim(coalesce(p_customer ->> 'address', ''))) < 10
     or char_length(btrim(coalesce(p_customer ->> 'city', ''))) < 2 then
    raise exception 'invalid_customer';
  end if;

  select * into v_settings from public.store_settings where id = 1;
  if not found then
    raise exception 'store_not_configured';
  end if;

  -- Lines: merge duplicates, lock variants in a stable order --------------
  for v_req in
    select (e ->> 'variant_id')::uuid as variant_id, sum((e ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_req.quantity < 1 or v_req.quantity > c_max_qty then
      raise exception 'invalid_quantity';
    end if;

    select v.id, v.sku, v.size, v.color, v.stock_quantity, v.price_override,
           v.is_active as variant_active, p.id as product_id, p.name, p.slug,
           p.base_price, p.is_active as product_active,
           (select i.url from public.product_images i
             where i.product_id = p.id order by i.sort_order, i.created_at limit 1) as image_url
      into v_row
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_req.variant_id
       for update of v;

    if not found or not v_row.variant_active or not v_row.product_active then
      raise exception 'variant_unavailable' using detail = v_req.variant_id::text;
    end if;
    if v_req.quantity > v_row.stock_quantity then
      raise exception 'out_of_stock'
        using detail = jsonb_build_object(
          'variant_id', v_row.id, 'available', v_row.stock_quantity)::text;
    end if;

    v_price := coalesce(v_row.price_override, v_row.base_price);
    v_subtotal := v_subtotal + v_price * v_req.quantity;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_row.product_id,
      'variant_id', v_row.id,
      'product_name', v_row.name,
      'product_slug', v_row.slug,
      'sku', v_row.sku,
      'size', v_row.size,
      'color', v_row.color,
      'image_url', v_row.image_url,
      'unit_price', v_price,
      'quantity', v_req.quantity
    );
  end loop;

  -- Coupon (locked so max_uses cannot be exceeded under concurrency) -------
  if v_coupon_code is not null then
    select * into v_coupon from public.coupons where code = v_coupon_code for update;
    if not found then
      raise exception 'coupon_invalid';
    end if;
    v_problem := public.coupon_problem(v_coupon, v_subtotal);
    if v_problem is not null then
      raise exception '%', v_problem;
    end if;
    v_discount := public.coupon_discount(v_coupon.discount_type, v_coupon.discount_value, v_subtotal);
  end if;

  v_delivery := case
    when v_subtotal - v_discount >= v_settings.free_delivery_min then 0
    else v_settings.delivery_charge
  end;
  v_total := v_subtotal - v_discount + v_delivery;
  v_payment_status := case when p_payment_method = 'cod' then 'due' else 'awaiting_payment' end;

  -- Write ------------------------------------------------------------------
  insert into public.orders (
    order_number, user_id, customer_email, delivery_name, delivery_phone,
    delivery_address, city, province, postal_code, notes, subtotal,
    delivery_charge, discount_amount, coupon_code, total_amount,
    payment_method, payment_status, status
  ) values (
    public.generate_order_number(),
    p_user_id,
    nullif(lower(btrim(coalesce(p_customer ->> 'email', ''))), ''),
    btrim(p_customer ->> 'name'),
    v_phone,
    btrim(p_customer ->> 'address'),
    btrim(p_customer ->> 'city'),
    nullif(btrim(coalesce(p_customer ->> 'province', '')), ''),
    nullif(btrim(coalesce(p_customer ->> 'postal_code', '')), ''),
    nullif(btrim(coalesce(p_customer ->> 'notes', '')), ''),
    v_subtotal, v_delivery, v_discount,
    case when v_coupon_code is not null then v_coupon.code end,
    v_total, p_payment_method, v_payment_status, 'pending'
  )
  returning * into v_order;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, product_slug, sku, size,
    color, image_url, unit_price, quantity
  )
  select v_order.id, l.product_id, l.variant_id, l.product_name, l.product_slug,
         l.sku, l.size, l.color, l.image_url, l.unit_price, l.quantity
    from jsonb_to_recordset(v_lines) as l(
      product_id uuid, variant_id uuid, product_name text, product_slug text,
      sku text, size text, color text, image_url text, unit_price numeric, quantity integer
    );

  update public.product_variants v
     set stock_quantity = v.stock_quantity - l.quantity
    from jsonb_to_recordset(v_lines) as l(variant_id uuid, quantity integer)
   where v.id = l.variant_id;

  insert into public.inventory_movements (variant_id, change, reason, order_id, actor_id)
  select l.variant_id, -l.quantity, 'order', v_order.id, p_user_id
    from jsonb_to_recordset(v_lines) as l(variant_id uuid, quantity integer);

  if v_coupon_code is not null then
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
    insert into public.coupon_redemptions (coupon_id, order_id, user_id)
    values (v_coupon.id, v_order.id, p_user_id);
  end if;

  insert into public.payments (order_id, method, amount, status)
  values (v_order.id, p_payment_method, v_total, v_payment_status);

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order.id, null, 'pending', p_user_id, 'Order placed');

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'subtotal', v_order.subtotal,
    'discount_amount', v_order.discount_amount,
    'delivery_charge', v_order.delivery_charge,
    'total_amount', v_order.total_amount,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'status', v_order.status
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Order access for customers and guests (server only).
-- Returns the order id when the signed-in owner matches, or the delivery
-- phone matches; otherwise NULL (never reveals whether the number exists).
-- ----------------------------------------------------------------------------
create or replace function public.resolve_order_access(
  p_order_number text,
  p_user_id uuid,
  p_phone text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id
    from public.orders o
   where o.order_number = upper(btrim(coalesce(p_order_number, '')))
     and (
       (p_user_id is not null and o.user_id = p_user_id)
       or (public.normalize_pk_phone(p_phone) is not null
           and o.delivery_phone = public.normalize_pk_phone(p_phone))
     );
$$;

-- Full order view for the tracking / account / payment pages.
create or replace function public.get_order_details(
  p_order_number text,
  p_user_id uuid,
  p_phone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.resolve_order_access(p_order_number, p_user_id, p_phone);
  v_result jsonb;
begin
  if v_id is null then
    return null;
  end if;
  select to_jsonb(o) - 'user_id'
    || jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(to_jsonb(i) - 'order_id' order by i.created_at)
          from public.order_items i where i.order_id = o.id), '[]'::jsonb),
      'history', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'from_status', h.from_status, 'to_status', h.to_status,
                 'note', h.note, 'created_at', h.created_at) order by h.created_at)
          from public.order_status_history h where h.order_id = o.id), '[]'::jsonb),
      'payments', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', p.id, 'method', p.method, 'amount', p.amount, 'status', p.status,
                 'transaction_id', p.transaction_id, 'has_receipt', p.receipt_path is not null,
                 'review_note', p.review_note, 'submitted_at', p.submitted_at,
                 'reviewed_at', p.reviewed_at, 'created_at', p.created_at)
                 order by p.seq)
          from public.payments p where p.order_id = o.id), '[]'::jsonb)
    )
    into v_result
    from public.orders o
   where o.id = v_id;
  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- submit_payment_evidence — wallet Transaction ID + receipt (server only).
-- The server uploads the receipt to payment-receipts/<order_id>/... first.
-- ----------------------------------------------------------------------------
create or replace function public.submit_payment_evidence(
  p_order_number text,
  p_user_id uuid,
  p_phone text,
  p_transaction_id text,
  p_receipt_path text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.resolve_order_access(p_order_number, p_user_id, p_phone);
  v_order public.orders;
  v_current public.payments;
  v_txn text := btrim(coalesce(p_transaction_id, ''));
begin
  if v_id is null then
    raise exception 'order_not_found';
  end if;
  select * into v_order from public.orders where id = v_id for update;

  if v_order.payment_method = 'cod' then
    raise exception 'cod_no_evidence';
  end if;
  if v_order.status in ('cancelled', 'returned') then
    raise exception 'order_closed';
  end if;
  if v_order.payment_status = 'pending_verification' then
    raise exception 'evidence_already_submitted';
  end if;
  if v_order.payment_status in ('approved', 'paid') then
    raise exception 'payment_already_approved';
  end if;
  if v_txn !~ '^[A-Za-z0-9-]{6,40}$' then
    raise exception 'invalid_transaction_id';
  end if;
  if coalesce(p_receipt_path, '') !~ ('^' || v_order.id::text || '/[A-Za-z0-9._-]+\.(jpg|png|webp)$') then
    raise exception 'invalid_receipt';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception 'note_too_long';
  end if;

  select * into v_current from public.payments
   where order_id = v_order.id order by seq desc limit 1 for update;

  begin
    if found and v_current.status = 'awaiting_payment' then
      -- First submission: complete the record created at checkout.
      update public.payments
         set status = 'pending_verification',
             transaction_id = v_txn,
             receipt_path = p_receipt_path,
             customer_note = nullif(btrim(coalesce(p_note, '')), ''),
             submitted_at = now()
       where id = v_current.id;
    else
      -- Resubmission after a rejection: keep the rejected record as history.
      insert into public.payments (
        order_id, method, amount, status, transaction_id, receipt_path,
        customer_note, submitted_at
      ) values (
        v_order.id, v_order.payment_method, v_order.total_amount,
        'pending_verification', v_txn, p_receipt_path,
        nullif(btrim(coalesce(p_note, '')), ''), now()
      );
    end if;
  exception when unique_violation then
    raise exception 'transaction_id_used';
  end;

  update public.orders set payment_status = 'pending_verification' where id = v_order.id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'payment_status', 'pending_verification'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Admin: review a payment (approve / reject with reason / mark paid).
-- ----------------------------------------------------------------------------
create or replace function public.review_payment(
  p_payment_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_new public.payment_status;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform public.require_admin();

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment_not_found';
  end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;

  -- Only the order's current payment record can be reviewed.
  if v_payment.status <> v_order.payment_status
     or exists (select 1 from public.payments p
                 where p.order_id = v_order.id and p.seq > v_payment.seq) then
    raise exception 'payment_superseded';
  end if;
  if char_length(coalesce(v_note, '')) > 500 then
    raise exception 'note_too_long';
  end if;

  case p_action
    when 'approve' then
      if v_payment.status <> 'pending_verification' then
        raise exception 'invalid_payment_action';
      end if;
      if v_order.status in ('cancelled', 'returned') then
        raise exception 'order_closed';
      end if;
      v_new := 'approved';
    when 'reject' then
      if v_payment.status <> 'pending_verification' then
        raise exception 'invalid_payment_action';
      end if;
      if char_length(coalesce(v_note, '')) < 3 then
        raise exception 'review_note_required';
      end if;
      v_new := 'rejected';
    when 'mark_paid' then
      if v_payment.status not in ('due', 'approved') then
        raise exception 'invalid_payment_action';
      end if;
      v_new := 'paid';
    else
      raise exception 'invalid_payment_action';
  end case;

  update public.payments
     set status = v_new,
         reviewed_by = (select auth.uid()),
         reviewed_at = now(),
         review_note = coalesce(v_note, review_note)
   where id = v_payment.id;

  update public.orders set payment_status = v_new where id = v_order.id;

  -- Proposal §6: an approved payment lets a pending order proceed.
  if v_new = 'approved' and v_order.status = 'pending' then
    update public.orders set status = 'confirmed' where id = v_order.id;
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
    values (v_order.id, 'pending', 'confirmed', (select auth.uid()), 'Payment approved');
  end if;

  return jsonb_build_object('payment_id', v_payment.id, 'payment_status', v_new);
end;
$$;

-- ----------------------------------------------------------------------------
-- Admin: change order status (proposal §7 workflow). Mirrors
-- ORDER_TRANSITIONS in src/lib/domain.ts. Cancel/return puts stock back.
-- ----------------------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid,
  p_to public.order_status,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_allowed public.order_status[];
  v_reason public.stock_reason;
begin
  perform public.require_admin();

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception 'note_too_long';
  end if;

  v_allowed := case v_order.status
    when 'pending' then array['confirmed', 'cancelled']::public.order_status[]
    when 'confirmed' then array['processing', 'cancelled']::public.order_status[]
    when 'processing' then array['shipped', 'cancelled']::public.order_status[]
    when 'shipped' then array['delivered', 'returned']::public.order_status[]
    when 'delivered' then array['returned']::public.order_status[]
    else array[]::public.order_status[]
  end;
  if not (p_to = any (v_allowed)) then
    raise exception 'invalid_transition';
  end if;

  -- A wallet order is confirmed only after its payment is verified.
  if p_to = 'confirmed' and v_order.payment_method <> 'cod'
     and v_order.payment_status not in ('approved', 'paid') then
    raise exception 'payment_not_verified';
  end if;

  if p_to in ('cancelled', 'returned') then
    v_reason := case when p_to = 'cancelled' then 'cancel' else 'return' end;
    -- Lock variants in a stable order before restocking.
    perform 1 from public.product_variants v
      where v.id in (select i.variant_id from public.order_items i where i.order_id = v_order.id)
      order by v.id
      for update;
    update public.product_variants v
       set stock_quantity = v.stock_quantity + s.qty
      from (select i.variant_id, sum(i.quantity)::integer as qty
              from public.order_items i
             where i.order_id = v_order.id and i.variant_id is not null
             group by i.variant_id) s
     where v.id = s.variant_id;
    insert into public.inventory_movements (variant_id, change, reason, order_id, actor_id)
    select i.variant_id, sum(i.quantity)::integer, v_reason, v_order.id, (select auth.uid())
      from public.order_items i
     where i.order_id = v_order.id and i.variant_id is not null
     group by i.variant_id;
  end if;

  update public.orders set status = p_to where id = v_order.id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order.id, v_order.status, p_to, (select auth.uid()),
          nullif(btrim(coalesce(p_note, '')), ''));

  return jsonb_build_object('order_id', v_order.id, 'from', v_order.status, 'to', p_to);
end;
$$;

-- ----------------------------------------------------------------------------
-- Admin: adjust stock by a delta (+ receive stock, − damage/correction).
-- ----------------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_variant_id uuid,
  p_change integer,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qty integer;
begin
  perform public.require_admin();
  if p_change is null or p_change = 0 or abs(p_change) > 100000 then
    raise exception 'invalid_quantity';
  end if;
  if char_length(coalesce(p_note, '')) > 300 then
    raise exception 'note_too_long';
  end if;

  select stock_quantity into v_qty from public.product_variants where id = p_variant_id for update;
  if not found then
    raise exception 'variant_not_found';
  end if;
  if v_qty + p_change < 0 then
    raise exception 'stock_negative';
  end if;

  update public.product_variants set stock_quantity = v_qty + p_change where id = p_variant_id;
  insert into public.inventory_movements (variant_id, change, reason, actor_id, note)
  values (p_variant_id, p_change, 'adjustment', (select auth.uid()),
          nullif(btrim(coalesce(p_note, '')), ''));
  return v_qty + p_change;
end;
$$;

-- ----------------------------------------------------------------------------
-- Function privileges. Supabase grants EXECUTE on new functions to anon and
-- authenticated by default, so revoke first, then grant what is needed.
-- ----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Used inside RLS policies / triggers, and harmless to call.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.normalize_pk_phone(text) to anon, authenticated;
grant execute on function public.coupon_discount(public.discount_type, numeric, numeric) to anon, authenticated;

-- Cart coupon preview.
grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;

-- Admin actions (each checks is_admin() itself).
grant execute on function public.review_payment(uuid, text, text) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;

-- Server-only (service role): guests must be able to place orders and
-- submit evidence, so these run behind validated API routes.
grant execute on function public.place_order(uuid, jsonb, jsonb, public.payment_method, text) to service_role;
grant execute on function public.resolve_order_access(text, uuid, text) to service_role;
grant execute on function public.get_order_details(text, uuid, text) to service_role;
grant execute on function public.submit_payment_evidence(text, uuid, text, text, text, text) to service_role;
