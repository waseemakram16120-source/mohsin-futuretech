-- ============================================================================
-- Mohsin FutureTech — 0008 Admin dashboard helpers (proposal §5)
-- ----------------------------------------------------------------------------
-- Aggregates are computed in the database so the dashboard stays correct no
-- matter how many orders exist (PostgREST returns at most 1000 rows).
-- Every function checks require_admin(); RLS already limits table reads.
-- ============================================================================

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
    -- Sales: orders that were not cancelled/returned (proposal §5 "sales").
    'sales_total', (select coalesce(sum(total_amount), 0) from public.orders where status not in ('cancelled', 'returned')),
    'sales_today', (select coalesce(sum(total_amount), 0) from public.orders
                     where status not in ('cancelled', 'returned') and created_at >= v_today),
    -- Money actually received or verified.
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
    'low_stock_threshold', v_threshold
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
