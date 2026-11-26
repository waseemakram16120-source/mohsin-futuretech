-- ============================================================================
-- Mohsin FutureTech — 0005 catalogue search, filters and facets
-- ----------------------------------------------------------------------------
-- Both functions are SECURITY INVOKER: they run as the caller (anon for
-- shoppers), so Row Level Security still decides what is visible.
-- ============================================================================

-- Prefix tsquery from free text: "puff jack" → 'puff:* & jack:*'.
-- Returns NULL when the text has no searchable words.
create or replace function public.prefix_tsquery(p_config regconfig, p_text text)
returns tsquery
language sql
immutable
set search_path = ''
as $$
  select case when s = '' then null else to_tsquery(p_config, s) end
  from (
    select coalesce(string_agg(quote_literal(w) || ':*', ' & '), '') as s
    from unnest(regexp_split_to_array(
      btrim(regexp_replace(lower(coalesce(p_text, '')), '[^[:alnum:]]+', ' ', 'g')), ' ')) as w
    where w <> ''
  ) q;
$$;

-- ----------------------------------------------------------------------------
-- catalog_search — one page of matching product ids, in display order, with
-- the total number of matches on every row.
--   p_audience  'men' / 'women' also include unisex products
--   p_sizes     a product matches if ONE active variant matches all of
--   p_colors    size, colour and (when p_in_stock) has stock
--   p_min/max   compared with the product's lowest selling price
--   p_sort      featured | newest | price-asc | price-desc | relevance
-- ----------------------------------------------------------------------------
create or replace function public.catalog_search(
  p_category_slug text default null,
  p_audience public.audience default null,
  p_query text default null,
  p_sizes text[] default null,
  p_colors text[] default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_in_stock boolean default false,
  p_on_sale boolean default false,
  p_new_only boolean default false,
  p_sort text default 'featured',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (product_id uuid, total_count bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_simple tsquery := public.prefix_tsquery('simple', left(p_query, 100));
  v_english tsquery := public.prefix_tsquery('english', left(p_query, 100));
  v_has_query boolean := nullif(btrim(coalesce(p_query, '')), '') is not null;
begin
  -- Text with no searchable characters matches nothing (not everything).
  if v_has_query and v_simple is null then
    return;
  end if;

  return query
  with matches as (
    select
      p.id,
      p.name,
      p.created_at,
      p.is_featured,
      (select min(coalesce(v.price_override, p.base_price))
         from public.product_variants v
        where v.product_id = p.id and v.is_active) as min_price,
      case when v_simple is null then 0
           else ts_rank(p.search_vector, v_simple)
                + ts_rank(to_tsvector('english', p.name || ' ' || coalesce(c.name, '')), v_english)
      end as rank
    from public.products p
    left join public.categories c on c.id = p.category_id
    where p.is_active
      and (p_category_slug is null or c.slug = p_category_slug)
      and (p_audience is null or p.audience in (p_audience, 'unisex'))
      and (not coalesce(p_on_sale, false) or p.compare_at_price is not null)
      and (not coalesce(p_new_only, false) or p.is_new_arrival)
      and (
        v_simple is null
        or p.search_vector @@ v_simple
        or to_tsvector('simple', coalesce(c.name, '')) @@ v_simple
        or to_tsvector('english', p.name || ' ' || coalesce(c.name, '')) @@ v_english
      )
      and exists (
        select 1 from public.product_variants v
         where v.product_id = p.id
           and v.is_active
           and (coalesce(cardinality(p_sizes), 0) = 0 or v.size = any (p_sizes))
           and (coalesce(cardinality(p_colors), 0) = 0 or v.color = any (p_colors))
           and (not coalesce(p_in_stock, false) or v.stock_quantity > 0)
      )
  )
  select m.id, count(*) over ()
    from matches m
   where (p_min_price is null or m.min_price >= p_min_price)
     and (p_max_price is null or m.min_price <= p_max_price)
   order by
     case when p_sort = 'relevance' then m.rank end desc nulls last,
     case when p_sort = 'featured' then m.is_featured end desc nulls last,
     case when p_sort = 'price-asc' then m.min_price end asc nulls last,
     case when p_sort = 'price-desc' then m.min_price end desc nulls last,
     m.created_at desc,
     m.name,
     m.id
   limit greatest(1, least(coalesce(p_limit, 24), 1000))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- ----------------------------------------------------------------------------
-- catalog_facets — filter options for a scope (before size/colour/price
-- filters are applied, so options never vanish while the shopper clicks).
-- ----------------------------------------------------------------------------
create or replace function public.catalog_facets(
  p_category_slug text default null,
  p_audience public.audience default null,
  p_query text default null,
  p_on_sale boolean default false,
  p_new_only boolean default false
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with scope as (
    select s.product_id from public.catalog_search(
      p_category_slug, p_audience, p_query, null, null, null, null,
      false, p_on_sale, p_new_only, 'newest', 1000, 0) s
  ),
  variants as (
    select v.size, v.color, v.color_hex, v.sort_order,
           coalesce(v.price_override, p.base_price) as price
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.is_active and v.product_id in (select product_id from scope)
  )
  select jsonb_build_object(
    'sizes', coalesce((select jsonb_agg(distinct size) from variants), '[]'::jsonb),
    'colors', coalesce((
      select jsonb_agg(jsonb_build_object('name', color, 'hex', hex) order by color)
        from (select color, min(color_hex) as hex from variants group by color) c), '[]'::jsonb),
    'min_price', (select min(price) from variants),
    'max_price', (select max(price) from variants),
    'total', (select count(*) from scope)
  );
$$;

revoke execute on function public.prefix_tsquery(regconfig, text) from public;
grant execute on function public.prefix_tsquery(regconfig, text) to anon, authenticated, service_role;
grant execute on function public.catalog_search(text, public.audience, text, text[], text[], numeric, numeric, boolean, boolean, boolean, text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.catalog_facets(text, public.audience, text, boolean, boolean) to anon, authenticated, service_role;
