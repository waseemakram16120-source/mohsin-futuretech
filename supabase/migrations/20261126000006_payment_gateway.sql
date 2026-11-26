-- ============================================================================
-- Mohsin FutureTech — 0006 direct payment gateway core (JazzCash / Easypaisa)
-- ----------------------------------------------------------------------------
-- Provider-agnostic, server-only payment ledger:
--   * payment_attempts  one row per attempt to pay an order through a gateway
--   * payment_events    every initiation / callback / status inquiry, with a
--                       UNIQUE dedupe key (durable replay + duplicate guard)
-- All writes go through SECURITY DEFINER functions callable only by the
-- service role, AFTER the server has verified the provider's signature.
-- The browser can never mark anything paid.
--
-- Safe for existing data: only new types/tables/functions are added; the
-- manual wallet-evidence path is retired (no rows are changed).
-- ============================================================================

create type public.payment_attempt_status as enum (
  'created',     -- attempt row exists, nothing sent to the provider yet
  'pending',     -- customer sent to the provider / request accepted
  'processing',  -- provider reports the payment as in progress
  'paid',        -- provider-verified success (terminal)
  'failed',      -- provider-verified failure
  'cancelled',   -- customer cancelled at the provider
  'expired'      -- attempt timed out / provider reports expiry
);

-- 'test' is the internal sandbox harness provider (never enabled in
-- production by the application; see src/lib/payments/config.ts).
create type public.payment_provider as enum ('jazzcash', 'easypaisa', 'test');

create table public.payment_attempts (
  id              uuid primary key default gen_random_uuid(),
  -- Opaque, unguessable reference sent to the provider (no sequential ids).
  reference       text not null unique check (reference ~ '^[A-Za-z0-9]{12,40}$'),
  order_id        uuid not null references public.orders (id) on delete restrict,
  provider        public.payment_provider not null,
  amount_minor    bigint not null check (amount_minor > 0),          -- paisa
  currency        text not null default 'PKR' check (currency = 'PKR'),
  status          public.payment_attempt_status not null default 'created',
  provider_txn_id text check (provider_txn_id is null or char_length(provider_txn_id) between 1 and 100),
  failure_code    text check (failure_code is null or char_length(failure_code) <= 60),
  failure_message text check (failure_message is null or char_length(failure_message) <= 300),
  needs_review    boolean not null default false,  -- e.g. paid after cancel / double charge
  expires_at      timestamptz not null,
  initiated_at    timestamptz,
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index payment_attempts_order_idx on public.payment_attempts (order_id, created_at desc);
create index payment_attempts_status_idx on public.payment_attempts (status, expires_at);
-- One provider transaction can confirm only one attempt (cross-order replay).
create unique index payment_attempts_provider_txn_unique
  on public.payment_attempts (provider, provider_txn_id) where provider_txn_id is not null;
-- At most one open attempt per order (prevents parallel double charges).
create unique index payment_attempts_one_open_per_order
  on public.payment_attempts (order_id) where status in ('created', 'pending', 'processing');

create trigger set_updated_at before update on public.payment_attempts
  for each row execute function public.set_updated_at();

create table public.payment_events (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid references public.payment_attempts (id) on delete set null,
  provider    public.payment_provider not null,
  event_type  text not null check (event_type in ('initiate', 'callback', 'return', 'status_inquiry', 'reconcile', 'expire')),
  -- Provider-specific unique key for this message (e.g. hash of the signed
  -- payload); a repeat is detected durably by this UNIQUE constraint.
  dedupe_key  text not null unique check (char_length(dedupe_key) between 8 and 200),
  outcome     text not null check (outcome in ('applied', 'duplicate', 'ignored', 'rejected')),
  reason      text check (reason is null or char_length(reason) <= 120),
  -- Redacted summary only (never secrets, hashes, PINs, OTPs or full bodies).
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index payment_events_attempt_idx on public.payment_events (attempt_id, created_at);
create index payment_events_outcome_idx on public.payment_events (outcome, created_at desc);

-- ----------------------------------------------------------------------------
-- Checkout now offers COD, JazzCash and Easypaisa only. Historic NayaPay
-- orders stay readable; new ones are refused.
-- ----------------------------------------------------------------------------
create or replace function public.guard_offered_payment_method()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_method not in ('cod', 'jazzcash', 'easypaisa') then
    raise exception 'payment_method_not_offered';
  end if;
  return new;
end;
$$;
create trigger guard_offered_payment_method
  before insert on public.orders
  for each row execute function public.guard_offered_payment_method();

-- The manual Transaction-ID + screenshot path is retired for gateway
-- methods: a receipt must never lead to "paid" (payment spec §2.3).
revoke execute on function public.submit_payment_evidence(text, uuid, text, text, text, text) from service_role;

-- ----------------------------------------------------------------------------
-- Transition table (mirrors ATTEMPT_TRANSITIONS in src/lib/payments/status.ts)
-- ----------------------------------------------------------------------------
create or replace function public.payment_attempt_can_transition(
  p_from public.payment_attempt_status,
  p_to public.payment_attempt_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'created' then p_to in ('pending', 'processing', 'paid', 'failed', 'cancelled', 'expired')
    when 'pending' then p_to in ('processing', 'paid', 'failed', 'cancelled', 'expired')
    when 'processing' then p_to in ('paid', 'failed', 'cancelled', 'expired')
    -- A provider-VERIFIED success after a failure/expiry still means money
    -- was taken, so it is recorded (and flagged when the order moved on).
    when 'failed' then p_to = 'paid'
    when 'cancelled' then p_to = 'paid'
    when 'expired' then p_to = 'paid'
    else false -- paid is terminal
  end;
$$;

-- ----------------------------------------------------------------------------
-- start_payment_attempt — server only. The caller has already authorised the
-- customer for this order (signed order cookie or signed-in owner).
-- Re-uses an open, unexpired attempt for the same provider (idempotent:
-- double clicks never create a second charge).
-- ----------------------------------------------------------------------------
create or replace function public.start_payment_attempt(
  p_order_id uuid,
  p_provider public.payment_provider,
  p_reference text,
  p_ttl_minutes integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_open public.payment_attempts;
  v_attempt public.payment_attempts;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status in ('cancelled', 'returned') then
    raise exception 'order_not_payable';
  end if;
  if v_order.payment_status in ('paid', 'approved') then
    raise exception 'already_paid';
  end if;
  if v_order.payment_method = 'cod' then
    raise exception 'cod_order';
  end if;
  if not (p_provider::text = v_order.payment_method::text or p_provider = 'test') then
    raise exception 'provider_mismatch';
  end if;
  if p_ttl_minutes is null or p_ttl_minutes < 5 or p_ttl_minutes > 120 then
    raise exception 'invalid_ttl';
  end if;

  -- Never-sent attempts past their expiry can be closed safely.
  update public.payment_attempts
     set status = 'expired', failure_code = 'timeout', failure_message = 'Payment window expired.'
   where order_id = v_order.id and status = 'created' and expires_at < now();

  select * into v_open from public.payment_attempts
   where order_id = v_order.id and status in ('created', 'pending', 'processing')
   for update;
  if found then
    if v_open.provider = p_provider and v_open.status = 'created' and v_open.expires_at > now() then
      return jsonb_build_object(
        'attempt_id', v_open.id, 'reference', v_open.reference, 'amount_minor', v_open.amount_minor,
        'currency', v_open.currency, 'provider', v_open.provider, 'expires_at', v_open.expires_at,
        'order_number', v_order.order_number, 'reused', true);
    end if;
    -- Something was already sent to a provider and its outcome is unknown:
    -- do not start another charge until it is reconciled (spec §14).
    if v_open.status in ('pending', 'processing') then
      raise exception 'payment_in_progress';
    end if;
    update public.payment_attempts
       set status = 'cancelled', failure_code = 'superseded', failure_message = 'Replaced by a new attempt.'
     where id = v_open.id;
  end if;

  insert into public.payment_attempts (reference, order_id, provider, amount_minor, currency, expires_at)
  values (
    p_reference, v_order.id, p_provider,
    (v_order.total_amount * 100)::bigint, 'PKR',
    now() + make_interval(mins => p_ttl_minutes)
  )
  returning * into v_attempt;

  return jsonb_build_object(
    'attempt_id', v_attempt.id, 'reference', v_attempt.reference, 'amount_minor', v_attempt.amount_minor,
    'currency', v_attempt.currency, 'provider', v_attempt.provider, 'expires_at', v_attempt.expires_at,
    'order_number', v_order.order_number, 'reused', false);
end;
$$;

-- ----------------------------------------------------------------------------
-- apply_payment_event — server only, called AFTER the provider adapter has
-- verified the message (signature/hash and merchant) per official docs.
-- Unverified messages are passed with p_verified = false so they are logged
-- as rejected without any side effect.
--   p_result: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'expired'
-- Returns { outcome, status, reason }.
-- ----------------------------------------------------------------------------
create or replace function public.apply_payment_event(
  p_provider public.payment_provider,
  p_reference text,
  p_event_type text,
  p_dedupe_key text,
  p_verified boolean,
  p_result text,
  p_provider_txn_id text default null,
  p_amount_minor bigint default null,
  p_currency text default null,
  p_reason text default null,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_attempt public.payment_attempts;
  v_order public.orders;
  v_to public.payment_attempt_status;
  v_outcome text := 'applied';
  v_reason text := left(p_reason, 120);
  v_details jsonb := coalesce(p_details, '{}'::jsonb);
begin
  -- 1. Durable duplicate / replay guard: first writer wins.
  insert into public.payment_events (provider, event_type, dedupe_key, outcome, reason, details)
  values (p_provider, p_event_type, p_dedupe_key, 'rejected', 'processing', v_details)
  on conflict (dedupe_key) do nothing
  returning id into v_event_id;
  if v_event_id is null then
    select pa.status::text into v_reason from public.payment_attempts pa
     where pa.reference = p_reference and pa.provider = p_provider;
    return jsonb_build_object('outcome', 'duplicate', 'status', v_reason, 'reason', 'duplicate_event');
  end if;

  select * into v_attempt from public.payment_attempts
   where reference = p_reference and provider = p_provider
   for update;
  if found then
    update public.payment_events set attempt_id = v_attempt.id where id = v_event_id;
  end if;

  -- 2. Unverified / malformed / unknown messages change nothing.
  if not coalesce(p_verified, false) then
    v_outcome := 'rejected'; v_reason := coalesce(v_reason, 'verification_failed');
  elsif v_attempt.id is null then
    v_outcome := 'rejected'; v_reason := 'unknown_reference';
  elsif p_result not in ('pending', 'processing', 'paid', 'failed', 'cancelled', 'expired') then
    v_outcome := 'rejected'; v_reason := 'unrecognised_status';
  elsif p_result = 'paid' and (p_provider_txn_id is null or btrim(p_provider_txn_id) = '') then
    v_outcome := 'rejected'; v_reason := 'missing_provider_txn_id';
  elsif p_result = 'paid' and (p_amount_minor is distinct from v_attempt.amount_minor) then
    v_outcome := 'rejected'; v_reason := 'amount_mismatch';
  elsif p_result = 'paid' and (upper(coalesce(p_currency, '')) is distinct from v_attempt.currency) then
    v_outcome := 'rejected'; v_reason := 'currency_mismatch';
  else
    v_to := p_result::public.payment_attempt_status;
    if v_to = v_attempt.status then
      v_outcome := 'ignored'; v_reason := 'no_change';
    elsif not public.payment_attempt_can_transition(v_attempt.status, v_to) then
      -- e.g. a late "failed" after a verified success never downgrades it.
      v_outcome := 'ignored'; v_reason := 'transition_not_allowed';
    end if;
  end if;

  if v_outcome <> 'applied' then
    update public.payment_events set outcome = v_outcome, reason = v_reason where id = v_event_id;
    return jsonb_build_object('outcome', v_outcome, 'status', v_attempt.status, 'reason', v_reason);
  end if;

  -- 3. Apply the verified transition.
  if v_to = 'paid' then
    begin
      update public.payment_attempts
         set status = 'paid', provider_txn_id = btrim(p_provider_txn_id), verified_at = now(),
             failure_code = null, failure_message = null
       where id = v_attempt.id;
    exception when unique_violation then
      -- The same provider transaction already confirmed another attempt.
      update public.payment_events set outcome = 'rejected', reason = 'provider_txn_reused' where id = v_event_id;
      return jsonb_build_object('outcome', 'rejected', 'status', v_attempt.status, 'reason', 'provider_txn_reused');
    end;

    select * into v_order from public.orders where id = v_attempt.order_id for update;
    if v_order.payment_status in ('paid', 'approved') then
      -- Customer was charged twice: keep the record, flag for refund.
      update public.payment_attempts set needs_review = true where id = v_attempt.id;
      v_reason := 'duplicate_charge_needs_review';
    elsif v_order.status in ('cancelled', 'returned') then
      update public.payment_attempts set needs_review = true where id = v_attempt.id;
      update public.orders set payment_status = 'paid' where id = v_order.id;
      v_reason := 'paid_after_cancellation_needs_review';
    else
      update public.orders set payment_status = 'paid' where id = v_order.id;
      -- The provider's transaction id lives on payment_attempts (no format
      -- assumptions). It is copied to the legacy payments row only when it
      -- fits that column's format, so an unexpected id can never block
      -- recording a verified payment.
      update public.payments
         set status = 'paid',
             transaction_id = case when btrim(p_provider_txn_id) ~ '^[A-Za-z0-9-]{6,40}$' then btrim(p_provider_txn_id) end,
             reviewed_at = now(), review_note = 'Verified by ' || p_provider::text
       where id = (select p.id from public.payments p where p.order_id = v_order.id order by p.seq desc limit 1);
      if v_order.status = 'pending' then
        update public.orders set status = 'confirmed' where id = v_order.id;
        insert into public.order_status_history (order_id, from_status, to_status, note)
        values (v_order.id, 'pending', 'confirmed', 'Payment verified by ' || p_provider::text);
      end if;
    end if;
  else
    update public.payment_attempts
       set status = v_to,
           initiated_at = coalesce(initiated_at, case when v_to in ('pending', 'processing') then now() end),
           failure_code = case when v_to in ('failed', 'cancelled', 'expired') then left(coalesce(p_reason, v_to::text), 60) end,
           failure_message = case v_to
             when 'failed' then 'The payment was not completed.'
             when 'cancelled' then 'The payment was cancelled.'
             when 'expired' then 'The payment window expired.'
           end
     where id = v_attempt.id;
  end if;

  update public.payment_events set outcome = 'applied', reason = v_reason where id = v_event_id;
  return jsonb_build_object('outcome', 'applied', 'status', v_to, 'reason', v_reason);
end;
$$;

-- ----------------------------------------------------------------------------
-- Attempts whose outcome is unknown (sent to the provider, past expiry):
-- the reconciliation job queries the provider's status API for these.
-- Never-sent attempts are simply expired.
-- ----------------------------------------------------------------------------
create or replace function public.payment_attempts_to_reconcile(p_limit integer default 50)
returns table (reference text, provider public.payment_provider, status public.payment_attempt_status, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_attempts pa
     set status = 'expired', failure_code = 'timeout', failure_message = 'Payment window expired.'
   where pa.status = 'created' and pa.expires_at < now();
  return query
    select a.reference, a.provider, a.status, a.expires_at
      from public.payment_attempts a
     where a.status in ('pending', 'processing') and a.expires_at < now()
     order by a.expires_at
     limit greatest(1, least(coalesce(p_limit, 50), 500));
end;
$$;

-- ----------------------------------------------------------------------------
-- Customer-safe payment state for an order (server only; caller authorised).
-- ----------------------------------------------------------------------------
create or replace function public.order_payment_state(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'order_status', o.status,
    'total_minor', (o.total_amount * 100)::bigint,
    'latest_attempt', (
      select jsonb_build_object(
        'reference', a.reference, 'provider', a.provider, 'status', a.status,
        'failure_message', a.failure_message, 'expires_at', a.expires_at,
        'verified_at', a.verified_at)
        from public.payment_attempts a where a.order_id = o.id
       order by a.created_at desc limit 1)
  )
  from public.orders o where o.id = p_order_id;
$$;

-- ----------------------------------------------------------------------------
-- RLS: admins may read the ledger; nobody writes except the functions above.
-- ----------------------------------------------------------------------------
alter table public.payment_attempts enable row level security;
alter table public.payment_attempts force row level security;
alter table public.payment_events enable row level security;
alter table public.payment_events force row level security;
revoke all on public.payment_attempts, public.payment_events from anon, authenticated;
grant select on public.payment_attempts, public.payment_events to authenticated;

create policy "payment_attempts: admin read" on public.payment_attempts
  for select to authenticated using ((select public.is_admin()));
create policy "payment_events: admin read" on public.payment_events
  for select to authenticated using ((select public.is_admin()));

revoke execute on function public.start_payment_attempt(uuid, public.payment_provider, text, integer) from public, anon, authenticated;
revoke execute on function public.apply_payment_event(public.payment_provider, text, text, text, boolean, text, text, bigint, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.payment_attempts_to_reconcile(integer) from public, anon, authenticated;
revoke execute on function public.order_payment_state(uuid) from public, anon, authenticated;
revoke execute on function public.guard_offered_payment_method() from public, anon, authenticated;
grant execute on function public.start_payment_attempt(uuid, public.payment_provider, text, integer) to service_role;
grant execute on function public.apply_payment_event(public.payment_provider, text, text, text, boolean, text, text, bigint, text, text, jsonb) to service_role;
grant execute on function public.payment_attempts_to_reconcile(integer) to service_role;
grant execute on function public.order_payment_state(uuid) to service_role;
grant execute on function public.payment_attempt_can_transition(public.payment_attempt_status, public.payment_attempt_status) to anon, authenticated, service_role;
