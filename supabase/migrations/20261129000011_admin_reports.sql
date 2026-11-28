-- ============================================================================
-- Mohsin FutureTech — 0011 Sales reports (proposal §5: daily/monthly
-- summaries, order counts, revenue, pending orders, best-selling products)
-- ----------------------------------------------------------------------------
-- Dates are calendar days in Pakistan time (Asia/Karachi), inclusive.
-- "Sales" = orders placed in the range that were not cancelled/returned.
-- "Collected" = those whose payment is approved or paid.
-- ============================================================================

create or replace function public.admin_report(p_from date, p_to date, p_group text default 'day')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'Asia/Karachi';
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  perform public.require_admin();
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 1100 then
    raise exception 'invalid_range';
  end if;
  if p_group not in ('day', 'month') then
    raise exception 'invalid_group';
  end if;
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;

  with o as (
    select x.*, (x.created_at at time zone v_tz)::date as local_day,
           x.status not in ('cancelled', 'returned') as counts,
           x.payment_status in ('approved', 'paid') and x.status not in ('cancelled', 'returned') as collected
      from public.orders x
     where x.created_at >= v_start and x.created_at < v_end
  ),
  periods as (
    select g::date as period
      from generate_series(
             date_trunc(p_group, p_from::timestamp),
             date_trunc(p_group, p_to::timestamp),
             case when p_group = 'day' then interval '1 day' else interval '1 month' end
           ) g
  ),
  series as (
    select p.period,
           count(o.id) as orders,
           count(o.id) filter (where o.counts) as valid_orders,
           coalesce(sum(o.total_amount) filter (where o.counts), 0) as sales,
           coalesce(sum(o.total_amount) filter (where o.collected), 0) as collected
      from periods p
      left join o on date_trunc(p_group, o.local_day::timestamp)::date = p.period
     group by p.period
  ),
  items as (
    select i.product_id, max(i.product_name) as name, max(i.product_slug) as slug,
           sum(i.quantity) as qty, sum(i.line_total) as revenue, count(distinct i.order_id) as orders
      from public.order_items i
      join o on o.id = i.order_id and o.counts
     group by i.product_id, case when i.product_id is null then i.product_name end
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'group', p_group,
    'summary', jsonb_build_object(
      'orders', (select count(*) from o),
      'valid_orders', (select count(*) from o where counts),
      'sales', (select coalesce(sum(total_amount), 0) from o where counts),
      'collected', (select coalesce(sum(total_amount), 0) from o where collected),
      'avg_order_value', (select coalesce(round(avg(total_amount), 2), 0) from o where counts),
      'items_sold', (select coalesce(sum(i.quantity), 0) from public.order_items i join o on o.id = i.order_id and o.counts),
      'discounts', (select coalesce(sum(discount_amount), 0) from o where counts),
      'delivery_charges', (select coalesce(sum(delivery_charge), 0) from o where counts),
      'cancelled', (select count(*) from o where status = 'cancelled'),
      'returned', (select count(*) from o where status = 'returned'),
      'customers', (select count(distinct coalesce(user_id::text, delivery_phone)) from o where counts)
    ),
    -- Live work queue, independent of the date range.
    'now', jsonb_build_object(
      'pending_orders', (select count(*) from public.orders where status = 'pending'),
      'to_ship', (select count(*) from public.orders where status in ('confirmed', 'processing')),
      'payments_to_verify', (select count(*) from public.orders where payment_status = 'pending_verification')
    ),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from o group by status) s), '{}'::jsonb),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object('method', payment_method, 'orders', n, 'sales', sales) order by sales desc)
        from (select payment_method, count(*) n, coalesce(sum(total_amount), 0) sales from o where counts group by payment_method) m
    ), '[]'::jsonb),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('period', period, 'orders', orders, 'valid_orders', valid_orders, 'sales', sales, 'collected', collected) order by period)
        from series
    ), '[]'::jsonb),
    'best_sellers', coalesce((
      select jsonb_agg(jsonb_build_object('product_id', product_id, 'name', name, 'slug', slug, 'qty', qty, 'revenue', revenue, 'orders', orders) order by qty desc, revenue desc)
        from (select * from items order by qty desc, revenue desc limit 10) t
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke execute on function public.admin_report(date, date, text) from public, anon;
grant execute on function public.admin_report(date, date, text) to authenticated;
