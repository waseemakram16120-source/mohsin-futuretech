-- ============================================================================
-- Mohsin FutureTech — 0009 Admin: customers list, safe product delete
-- ============================================================================

-- Customers with order counts and spend, searched and paged in SQL.
create or replace function public.admin_customers(
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  created_at timestamptz,
  orders_count bigint,
  total_spent numeric,
  last_order_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public.require_admin();
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 then
    raise exception 'invalid_page';
  end if;
  return query
  with c as (
    select p.id, p.full_name, p.email, p.phone, p.created_at
      from public.profiles p
     where p.role = 'customer'
       and (v_q is null
            or p.full_name ilike '%' || v_q || '%'
            or p.email ilike '%' || v_q || '%'
            or coalesce(p.phone, '') like '%' || regexp_replace(v_q, '\D', '', 'g') || '%' and regexp_replace(v_q, '\D', '', 'g') <> '')
  )
  select c.id, c.full_name, c.email, c.phone, c.created_at,
         count(o.id) as orders_count,
         coalesce(sum(o.total_amount) filter (where o.status not in ('cancelled', 'returned')), 0) as total_spent,
         max(o.created_at) as last_order_at,
         count(*) over () as total_count
    from c
    left join public.orders o on o.user_id = c.id
   group by c.id, c.full_name, c.email, c.phone, c.created_at
   order by max(o.created_at) desc nulls last, c.created_at desc
   limit p_limit offset p_offset;
end;
$$;
revoke execute on function public.admin_customers(text, integer, integer) from public, anon;
grant execute on function public.admin_customers(text, integer, integer) to authenticated;

-- Products that were ever ordered are archived (is_active = false), never
-- deleted, so reports and order history keep their product links.
create or replace function public.guard_product_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.order_items i where i.product_id = old.id) then
    raise exception 'product_has_orders';
  end if;
  return old;
end;
$$;
create trigger guard_product_delete
  before delete on public.products
  for each row execute function public.guard_product_delete();
revoke execute on function public.guard_product_delete() from public, anon, authenticated;
