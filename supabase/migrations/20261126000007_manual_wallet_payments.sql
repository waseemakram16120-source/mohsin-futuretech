-- ============================================================================
-- Mohsin FutureTech — 0007 Manual wallet payments (proposal §4 and §6)
-- ----------------------------------------------------------------------------
-- The proposal's payment flow for EasyPaisa / JazzCash is MANUAL: the
-- customer pays the store's account, submits the Transaction ID and a
-- receipt, and the payment shows as "Pending Verification" until an admin
-- approves or rejects it (review_payment). Nothing a customer submits can
-- make a payment approved or paid.
--
-- 0006 retired this path when the direct gateway core was added. The store
-- owner chose manual verification until a merchant gateway is approved, so
-- it is re-enabled here. Each wallet runs in ONE mode at a time (server env
-- PAYMENTS_GATEWAY_METHODS); these guards keep the two paths from ever
-- overlapping on the same order:
--   - evidence is refused while a gateway charge is pending at a provider;
--   - a gateway charge cannot start while evidence is under review.
-- ============================================================================

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
  -- An online (gateway) charge whose outcome is still unknown must settle
  -- first, so the same order is never paid twice.
  if exists (select 1 from public.payment_attempts a
              where a.order_id = v_order.id and a.status in ('pending', 'processing')) then
    raise exception 'payment_in_progress';
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

grant execute on function public.submit_payment_evidence(text, uuid, text, text, text, text) to service_role;

-- ----------------------------------------------------------------------------
-- No gateway attempt while manual evidence is waiting for review.
-- ----------------------------------------------------------------------------
create or replace function public.guard_attempt_vs_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.orders o
              where o.id = new.order_id and o.payment_status = 'pending_verification') then
    raise exception 'evidence_under_review';
  end if;
  return new;
end;
$$;
create trigger guard_attempt_vs_evidence
  before insert on public.payment_attempts
  for each row execute function public.guard_attempt_vs_evidence();
revoke execute on function public.guard_attempt_vs_evidence() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Latest payment record for an order (customer-facing order page): status,
-- when evidence was submitted and the admin's rejection reason. Never the
-- receipt path. Server only (the server has already authorised the caller).
-- ----------------------------------------------------------------------------
create or replace function public.order_payment_evidence(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', p.status,
    'transaction_id', p.transaction_id,
    'submitted_at', p.submitted_at,
    'review_note', case when p.status = 'rejected' then p.review_note end,
    'reviewed_at', p.reviewed_at
  )
    from public.payments p
   where p.order_id = p_order_id
   order by p.seq desc
   limit 1;
$$;
revoke execute on function public.order_payment_evidence(uuid) from public, anon, authenticated;
grant execute on function public.order_payment_evidence(uuid) to service_role;
