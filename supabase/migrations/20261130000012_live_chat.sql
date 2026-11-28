-- ============================================================================
-- Mohsin FutureTech — 0012 Live chat between customers and the store
-- ----------------------------------------------------------------------------
--   chat_conversations  one per customer conversation. A signed-in customer
--                       is linked by user_id; a guest by a random token whose
--                       SHA-256 hash is stored here (the token itself lives
--                       only in the guest's httpOnly cookie).
--   chat_messages       the messages, plain text, 1–1000 characters.
--
-- Nobody writes these tables directly. Customer messages go through the
-- server (service role) after it has checked the cookie / session; admin
-- replies go through admin-only functions. RLS lets a signed-in customer
-- read only their own conversations, and admins read all.
-- ============================================================================

create type public.chat_status as enum ('open', 'closed');
create type public.chat_sender as enum ('customer', 'admin');

create table public.chat_conversations (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.profiles (id) on delete set null,
  guest_token_hash      text check (guest_token_hash is null or guest_token_hash ~ '^[0-9a-f]{64}$'),
  customer_name         text not null check (char_length(customer_name) between 2 and 80),
  customer_phone        text check (customer_phone is null or customer_phone ~ '^03[0-9]{9}$'),
  order_number          text check (order_number is null or order_number ~ '^MF-[0-9]{6}-[0-9]{5,}$'),
  status                public.chat_status not null default 'open',
  last_message_at       timestamptz not null default now(),
  last_message_preview  text not null default '' check (char_length(last_message_preview) <= 140),
  last_sender           public.chat_sender,
  unread_for_admin      integer not null default 0 check (unread_for_admin >= 0),
  unread_for_customer   integer not null default 0 check (unread_for_customer >= 0),
  closed_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (user_id is not null or guest_token_hash is not null)
);
create index chat_conversations_inbox_idx on public.chat_conversations (status, last_message_at desc);
create index chat_conversations_user_idx on public.chat_conversations (user_id, last_message_at desc);
create unique index chat_conversations_guest_idx on public.chat_conversations (guest_token_hash) where guest_token_hash is not null;

create table public.chat_messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  sender          public.chat_sender not null,
  sender_id       uuid references public.profiles (id) on delete set null,
  body            text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at      timestamptz not null default now()
);
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, id);

create trigger chat_conversations_updated_at
  before update on public.chat_conversations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS: read-only for clients; writes only through the functions below.
-- ----------------------------------------------------------------------------
alter table public.chat_conversations enable row level security;
alter table public.chat_conversations force row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_messages force row level security;
revoke all on public.chat_conversations, public.chat_messages from anon, authenticated;
grant select on public.chat_conversations, public.chat_messages to authenticated;

create policy "chat_conversations: read own" on public.chat_conversations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "chat_conversations: admin read" on public.chat_conversations
  for select to authenticated using ((select public.is_admin()));
create policy "chat_messages: read own" on public.chat_messages
  for select to authenticated using (
    exists (select 1 from public.chat_conversations c
             where c.id = conversation_id and c.user_id = (select auth.uid()))
  );
create policy "chat_messages: admin read" on public.chat_messages
  for select to authenticated using ((select public.is_admin()));

-- ----------------------------------------------------------------------------
-- Shared: append a message and update the conversation summary atomically.
-- ----------------------------------------------------------------------------
create or replace function public.chat_append(
  p_conversation_id uuid,
  p_sender public.chat_sender,
  p_sender_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]', '', 'g'));
  v_conv public.chat_conversations;
  v_msg public.chat_messages;
begin
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'invalid_message';
  end if;
  select * into v_conv from public.chat_conversations where id = p_conversation_id for update;
  if not found then
    raise exception 'conversation_not_found';
  end if;
  if v_conv.status = 'closed' and p_sender = 'customer' then
    raise exception 'conversation_closed';
  end if;

  insert into public.chat_messages (conversation_id, sender, sender_id, body)
  values (p_conversation_id, p_sender, p_sender_id, v_body)
  returning * into v_msg;

  update public.chat_conversations set
    last_message_at = v_msg.created_at,
    last_message_preview = left(regexp_replace(v_body, '\s+', ' ', 'g'), 140),
    last_sender = p_sender,
    unread_for_admin = case when p_sender = 'customer' then unread_for_admin + 1 else 0 end,
    unread_for_customer = case when p_sender = 'admin' then unread_for_customer + 1 else 0 end,
    status = case when p_sender = 'admin' then 'open'::public.chat_status else status end,
    closed_at = case when p_sender = 'admin' then null else closed_at end
  where id = p_conversation_id;

  return jsonb_build_object('id', v_msg.id, 'sender', v_msg.sender, 'body', v_msg.body, 'created_at', v_msg.created_at);
end;
$$;
revoke execute on function public.chat_append(uuid, public.chat_sender, uuid, text) from public, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Customer side (service role only: the server has checked cookie/session).
-- ----------------------------------------------------------------------------
create or replace function public.chat_start(
  p_user_id uuid,
  p_guest_token_hash text,
  p_name text,
  p_phone text,
  p_order_number text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.chat_conversations;
  v_phone text := public.normalize_pk_phone(p_phone);
  v_order text := nullif(upper(btrim(coalesce(p_order_number, ''))), '');
begin
  if p_user_id is null and coalesce(p_guest_token_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner';
  end if;
  if p_phone is not null and btrim(p_phone) <> '' and v_phone is null then
    raise exception 'invalid_phone';
  end if;
  if v_order is not null and v_order !~ '^MF-[0-9]{6}-[0-9]{5,}$' then
    raise exception 'invalid_order_number';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception 'invalid_name';
  end if;

  -- A signed-in customer keeps one open conversation.
  if p_user_id is not null then
    select * into v_conv from public.chat_conversations
     where user_id = p_user_id and status = 'open'
     order by last_message_at desc limit 1;
  end if;
  if v_conv.id is null then
    insert into public.chat_conversations (user_id, guest_token_hash, customer_name, customer_phone, order_number)
    values (p_user_id, case when p_user_id is null then p_guest_token_hash end, btrim(p_name), v_phone, v_order)
    returning * into v_conv;
  end if;

  perform public.chat_append(v_conv.id, 'customer', p_user_id, p_body);
  return jsonb_build_object('conversation_id', v_conv.id);
end;
$$;

create or replace function public.chat_customer_post(p_conversation_id uuid, p_user_id uuid, p_body text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.chat_append(p_conversation_id, 'customer', p_user_id, p_body);
$$;

-- Messages after p_after_id; marks the store's replies as read by the customer.
create or replace function public.chat_customer_read(p_conversation_id uuid, p_after_id bigint default 0)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.chat_conversations;
begin
  update public.chat_conversations set unread_for_customer = 0
   where id = p_conversation_id
   returning * into v_conv;
  if not found then
    raise exception 'conversation_not_found';
  end if;
  return jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', v_conv.id, 'status', v_conv.status, 'customer_name', v_conv.customer_name,
      'order_number', v_conv.order_number),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body, 'created_at', m.created_at) order by m.id)
        from (select * from public.chat_messages
               where conversation_id = v_conv.id and id > coalesce(p_after_id, 0)
               order by id limit 200) m), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.chat_start(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.chat_customer_post(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.chat_customer_read(uuid, bigint) from public, anon, authenticated;
grant execute on function public.chat_start(uuid, text, text, text, text, text) to service_role;
grant execute on function public.chat_customer_post(uuid, uuid, text) to service_role;
grant execute on function public.chat_customer_read(uuid, bigint) to service_role;

-- ----------------------------------------------------------------------------
-- Admin side (signed-in admins).
-- ----------------------------------------------------------------------------
create or replace function public.chat_admin_reply(p_conversation_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return public.chat_append(p_conversation_id, 'admin', (select auth.uid()), p_body);
end;
$$;

create or replace function public.chat_admin_mark_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.chat_conversations set unread_for_admin = 0 where id = p_conversation_id;
end;
$$;

create or replace function public.chat_admin_set_status(p_conversation_id uuid, p_status public.chat_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.chat_conversations
     set status = p_status,
         closed_at = case when p_status = 'closed' then now() else null end,
         unread_for_admin = case when p_status = 'closed' then 0 else unread_for_admin end
   where id = p_conversation_id;
  if not found then
    raise exception 'conversation_not_found';
  end if;
end;
$$;

revoke execute on function public.chat_admin_reply(uuid, text) from public, anon;
revoke execute on function public.chat_admin_mark_read(uuid) from public, anon;
revoke execute on function public.chat_admin_set_status(uuid, public.chat_status) from public, anon;
grant execute on function public.chat_admin_reply(uuid, text) to authenticated;
grant execute on function public.chat_admin_mark_read(uuid) to authenticated;
grant execute on function public.chat_admin_set_status(uuid, public.chat_status) to authenticated;

-- Dashboard: conversations waiting for a reply.
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi';
  v_threshold integer;
  v_result jsonb;
begin
  perform public.require_admin();
  select coalesce(low_stock_threshold, 5) into v_threshold from public.store_settings where id = 1;

  select jsonb_build_object(
    'orders_total', (select count(*) from public.orders),
    'orders_today', (select count(*) from public.orders where created_at >= v_today),
    'orders_pending', (select count(*) from public.orders where status = 'pending'),
    'orders_to_ship', (select count(*) from public.orders where status in ('confirmed', 'processing')),
    'sales_total', (select coalesce(sum(total_amount), 0) from public.orders where status not in ('cancelled', 'returned')),
    'sales_today', (select coalesce(sum(total_amount), 0) from public.orders
                     where status not in ('cancelled', 'returned') and created_at >= v_today),
    'revenue_collected', (select coalesce(sum(total_amount), 0) from public.orders
                           where payment_status in ('approved', 'paid') and status not in ('cancelled', 'returned')),
    'payments_to_verify', (select count(*) from public.orders where payment_status = 'pending_verification'),
    'cod_to_collect', (select count(*) from public.orders
                        where payment_method = 'cod' and payment_status = 'due' and status = 'delivered'),
    'customers', (select count(*) from public.profiles where role = 'customer'),
    'products_active', (select count(*) from public.products where is_active),
    'low_stock', (select count(*) from public.product_variants v join public.products p on p.id = v.product_id
                   where v.is_active and p.is_active and v.stock_quantity <= v_threshold),
    'out_of_stock', (select count(*) from public.product_variants v join public.products p on p.id = v.product_id
                      where v.is_active and p.is_active and v.stock_quantity = 0),
    'low_stock_threshold', v_threshold,
    'chats_waiting', (select count(*) from public.chat_conversations where status = 'open' and unread_for_admin > 0)
  ) into v_result;
  return v_result;
end;
$$;
