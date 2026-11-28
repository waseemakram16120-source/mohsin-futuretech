-- ============================================================================
-- Mohsin FutureTech — 0010 Save a product and its variants in ONE transaction
-- ----------------------------------------------------------------------------
-- Existing variants are updated in place (ids never change, so carts,
-- wishlists and past orders keep their links); new ones are inserted with
-- their opening stock (logged by log_initial_stock). Variants are never
-- deleted — they are switched off with is_active. Stock of existing
-- variants is changed only through adjust_stock (audited).
-- ============================================================================

create or replace function public.admin_save_product(p_product_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_product_id;
  v jsonb;
  v_pos integer := 0;
  v_constraint text;
begin
  perform public.require_admin();
  if jsonb_typeof(p -> 'variants') <> 'array' or jsonb_array_length(p -> 'variants') = 0 then
    raise exception 'variants_required';
  end if;

  begin
    if v_id is null then
      insert into public.products (category_id, audience, name, slug, description, details, base_price,
                                   compare_at_price, is_active, is_featured, is_new_arrival)
      values (
        nullif(p ->> 'category_id', '')::uuid,
        (p ->> 'audience')::public.audience,
        p ->> 'name',
        p ->> 'slug',
        coalesce(p ->> 'description', ''),
        coalesce(array(select jsonb_array_elements_text(p -> 'details')), '{}'),
        (p ->> 'base_price')::numeric,
        nullif(p ->> 'compare_at_price', '')::numeric,
        coalesce((p ->> 'is_active')::boolean, true),
        coalesce((p ->> 'is_featured')::boolean, false),
        coalesce((p ->> 'is_new_arrival')::boolean, false)
      )
      returning id into v_id;
    else
      update public.products set
        category_id = nullif(p ->> 'category_id', '')::uuid,
        audience = (p ->> 'audience')::public.audience,
        name = p ->> 'name',
        slug = p ->> 'slug',
        description = coalesce(p ->> 'description', ''),
        details = coalesce(array(select jsonb_array_elements_text(p -> 'details')), '{}'),
        base_price = (p ->> 'base_price')::numeric,
        compare_at_price = nullif(p ->> 'compare_at_price', '')::numeric,
        is_active = coalesce((p ->> 'is_active')::boolean, true),
        is_featured = coalesce((p ->> 'is_featured')::boolean, false),
        is_new_arrival = coalesce((p ->> 'is_new_arrival')::boolean, false)
      where id = v_id;
      if not found then
        raise exception 'product_not_found';
      end if;
    end if;

    for v in select value from jsonb_array_elements(p -> 'variants') loop
      v_pos := v_pos + 1;
      if nullif(v ->> 'id', '') is not null then
        update public.product_variants set
          size = v ->> 'size',
          color = v ->> 'color',
          color_hex = v ->> 'color_hex',
          sku = v ->> 'sku',
          price_override = nullif(v ->> 'price_override', '')::numeric,
          is_active = coalesce((v ->> 'is_active')::boolean, true),
          sort_order = v_pos
        where id = (v ->> 'id')::uuid and product_id = v_id;
        if not found then
          raise exception 'variant_not_found';
        end if;
      else
        insert into public.product_variants (product_id, sku, size, color, color_hex, price_override,
                                             stock_quantity, sort_order, is_active)
        values (
          v_id, v ->> 'sku', v ->> 'size', v ->> 'color', v ->> 'color_hex',
          nullif(v ->> 'price_override', '')::numeric,
          greatest(coalesce((v ->> 'stock')::integer, 0), 0),
          v_pos,
          coalesce((v ->> 'is_active')::boolean, true)
        );
      end if;
    end loop;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      raise exception '%', case
        when v_constraint like '%slug%' then 'duplicate_slug'
        when v_constraint like '%sku%' then 'duplicate_sku'
        else 'duplicate_variant'
      end;
    when check_violation or not_null_violation or invalid_text_representation then
      raise exception 'invalid_product';
  end;

  return v_id;
end;
$$;
revoke execute on function public.admin_save_product(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_product(uuid, jsonb) to authenticated;
