-- ============================================================================
-- Mohsin FutureTech — Sample Seed Data (Step 1)
-- Run AFTER supabase/schema.sql, policies.sql and storage.sql in the
-- Supabase Dashboard -> SQL Editor.
-- ----------------------------------------------------------------------------
-- Seeds 7 categories, 12 sample fashion products with size/color/stock
-- variants (realistic Pakistani prices in PKR), and 1 coupon: WELCOME10.
-- Product image_url is left NULL on purpose — real product photos are
-- uploaded to the `product-images` bucket in Step 2.
-- Safe to re-run: every insert uses ON CONFLICT ... DO NOTHING.
-- No real customer, order or payment data is seeded.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Categories
-- ----------------------------------------------------------------------------
insert into public.categories (id, name, slug, description, sort_order, is_active)
values
  ('a0000000-0000-4000-8000-000000000001', 'Men',         'men',         'Men''s clothing — shirts, jeans, trousers and more.',        1, true),
  ('a0000000-0000-4000-8000-000000000002', 'Women',       'women',       'Women''s clothing — jeans, shirts and seasonal picks.',       2, true),
  ('a0000000-0000-4000-8000-000000000003', 'Jackets',     'jackets',     'Denim, biker and casual jackets for every season.',            3, true),
  ('a0000000-0000-4000-8000-000000000004', 'Jeans',       'jeans',       'Classic, slim-fit and skinny jeans in every wash.',            4, true),
  ('a0000000-0000-4000-8000-000000000005', 'Shirts',      'shirts',      'Oxford, checked, lawn and casual shirts.',                     5, true),
  ('a0000000-0000-4000-8000-000000000006', 'Trousers',    'trousers',    'Chinos and formal dress trousers.',                            6, true),
  ('a0000000-0000-4000-8000-000000000007', 'Accessories', 'accessories', 'Belts, wallets and everyday essentials.',                     7, true)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- Products (12)
-- ----------------------------------------------------------------------------
insert into public.products
  (id, category_id, name, slug, description, base_price, compare_at_price, is_featured, is_new_arrival, is_active)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'Men''s Classic Blue Jeans',      'mens-classic-blue-jeans',     'Mid-rise straight-fit jeans in a classic stonewash blue. Durable everyday denim.',        3499, 4499, true,  false, true),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004', 'Men''s Slim-Fit Black Jeans',    'mens-slim-fit-black-jeans',   'Slim-fit stretch jeans in deep black. Smart, comfortable and easy to pair.',                 3799, null, true,  false, true),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 'Women''s High-Waist Skinny Jeans','womens-high-waist-skinny-jeans','High-waist skinny jeans with stretch comfort and a clean, modern wash.',                 3999, 4999, true,  true,  true),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', 'Men''s Denim Jacket',           'mens-denim-jacket',           'Classic trucker denim jacket with button front and chest pockets.',                        5999, 7499, true,  false, true),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003', 'Men''s Leather-Style Biker Jacket','mens-biker-jacket',         'Leather-style biker jacket with zip front and quilted shoulders.',                              8999, 10999, false, true,  true),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000005', 'Men''s Oxford Cotton Shirt',    'mens-oxford-cotton-shirt',    'Breathable Oxford cotton shirt with button-down collar. Office and casual ready.',           2499, 2999, false, false, true),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000005', 'Men''s Checked Casual Shirt',   'mens-checked-casual-shirt',   'Soft checked casual shirt with a relaxed fit and roll-up sleeves.',                             2299, null, false, true,  true),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000005', 'Women''s Floral Lawn Shirt',    'womens-floral-lawn-shirt',    'Lightweight floral lawn shirt, perfect for summer days.',                                       2799, 3499, true,  true,  true),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000006', 'Men''s Chino Trousers',         'mens-chino-trousers',         'Stretch chino trousers with a tapered leg and clean finish.',                                     2999, 3999, false, false, true),
  ('b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000006', 'Men''s Formal Dress Trousers',  'mens-formal-dress-trousers',  'Flat-front formal trousers in wrinkle-resistant fabric.',                                       3299, null, false, false, true),
  ('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000005', 'Men''s Pique Polo T-Shirt',     'mens-pique-polo-tshirt',      'Classic pique polo t-shirt in breathable cotton.',                                             1499, 1999, false, true,  true),
  ('b0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000007', 'Men''s Leather Belt',           'mens-leather-belt',           'Genuine leather belt with a polished metal buckle.',                                          1299, 1799, false, false, true)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- Product variants — size / color / stock / SKU per product
-- ----------------------------------------------------------------------------
insert into public.product_variants (product_id, sku, size, color, stock_quantity)
values
  -- 1. Men's Classic Blue Jeans (waist sizes)
  ('b0000000-0000-4000-8000-000000000001', 'MF-JN-001-BLU-30', '30', 'Blue', 18),
  ('b0000000-0000-4000-8000-000000000001', 'MF-JN-001-BLU-32', '32', 'Blue', 24),
  ('b0000000-0000-4000-8000-000000000001', 'MF-JN-001-BLU-34', '34', 'Blue', 20),
  ('b0000000-0000-4000-8000-000000000001', 'MF-JN-001-BLU-36', '36', 'Blue', 12),
  -- 2. Men's Slim-Fit Black Jeans
  ('b0000000-0000-4000-8000-000000000002', 'MF-JN-002-BLK-30', '30', 'Black', 15),
  ('b0000000-0000-4000-8000-000000000002', 'MF-JN-002-BLK-32', '32', 'Black', 22),
  ('b0000000-0000-4000-8000-000000000002', 'MF-JN-002-BLK-34', '34', 'Black', 16),
  ('b0000000-0000-4000-8000-000000000002', 'MF-JN-002-BLK-36', '36', 'Black', 9),
  -- 3. Women's High-Waist Skinny Jeans
  ('b0000000-0000-4000-8000-000000000003', 'MF-JN-003-BLU-28', '28', 'Blue', 14),
  ('b0000000-0000-4000-8000-000000000003', 'MF-JN-003-BLU-30', '30', 'Blue', 19),
  ('b0000000-0000-4000-8000-000000000003', 'MF-JN-003-BLK-30', '30', 'Black', 11),
  ('b0000000-0000-4000-8000-000000000003', 'MF-JN-003-BLK-32', '32', 'Black', 8),
  -- 4. Men's Denim Jacket
  ('b0000000-0000-4000-8000-000000000004', 'MF-JK-001-BLU-M', 'M', 'Blue', 10),
  ('b0000000-0000-4000-8000-000000000004', 'MF-JK-001-BLU-L', 'L', 'Blue', 14),
  ('b0000000-0000-4000-8000-000000000004', 'MF-JK-001-BLU-XL', 'XL', 'Blue', 7),
  -- 5. Men's Biker Jacket
  ('b0000000-0000-4000-8000-000000000005', 'MF-JK-002-BLK-M', 'M', 'Black', 6),
  ('b0000000-0000-4000-8000-000000000005', 'MF-JK-002-BLK-L', 'L', 'Black', 9),
  ('b0000000-0000-4000-8000-000000000005', 'MF-JK-002-BLK-XL', 'XL', 'Black', 5),
  -- 6. Men's Oxford Cotton Shirt
  ('b0000000-0000-4000-8000-000000000006', 'MF-SH-001-WHT-M', 'M', 'White', 20),
  ('b0000000-0000-4000-8000-000000000006', 'MF-SH-001-WHT-L', 'L', 'White', 18),
  ('b0000000-0000-4000-8000-000000000006', 'MF-SH-001-BLU-M', 'M', 'Blue', 16),
  ('b0000000-0000-4000-8000-000000000006', 'MF-SH-001-BLU-L', 'L', 'Blue', 13),
  -- 7. Men's Checked Casual Shirt
  ('b0000000-0000-4000-8000-000000000007', 'MF-SH-002-RED-M', 'M', 'Red', 17),
  ('b0000000-0000-4000-8000-000000000007', 'MF-SH-002-RED-L', 'L', 'Red', 15),
  ('b0000000-0000-4000-8000-000000000007', 'MF-SH-002-GRN-XL', 'XL', 'Green', 10),
  -- 8. Women's Floral Lawn Shirt
  ('b0000000-0000-4000-8000-000000000008', 'MF-SH-003-PNK-S', 'S', 'Pink', 12),
  ('b0000000-0000-4000-8000-000000000008', 'MF-SH-003-PNK-M', 'M', 'Pink', 16),
  ('b0000000-0000-4000-8000-000000000008', 'MF-SH-003-PNK-L', 'L', 'Pink', 9),
  -- 9. Men's Chino Trousers
  ('b0000000-0000-4000-8000-000000000009', 'MF-TR-001-KHK-30', '30', 'Khaki', 14),
  ('b0000000-0000-4000-8000-000000000009', 'MF-TR-001-KHK-32', '32', 'Khaki', 18),
  ('b0000000-0000-4000-8000-000000000009', 'MF-TR-001-KHK-34', '34', 'Khaki', 11),
  ('b0000000-0000-4000-8000-000000000009', 'MF-TR-001-NVY-32', '32', 'Navy', 10),
  -- 10. Men's Formal Dress Trousers
  ('b0000000-0000-4000-8000-000000000010', 'MF-TR-002-BLK-32', '32', 'Black', 13),
  ('b0000000-0000-4000-8000-000000000010', 'MF-TR-002-BLK-34', '34', 'Black', 12),
  ('b0000000-0000-4000-8000-000000000010', 'MF-TR-002-GRY-32', '32', 'Grey', 8),
  -- 11. Men's Pique Polo T-Shirt
  ('b0000000-0000-4000-8000-000000000011', 'MF-TS-001-WHT-M', 'M', 'White', 25),
  ('b0000000-0000-4000-8000-000000000011', 'MF-TS-001-WHT-L', 'L', 'White', 22),
  ('b0000000-0000-4000-8000-000000000011', 'MF-TS-001-NVY-M', 'M', 'Navy', 19),
  ('b0000000-0000-4000-8000-000000000011', 'MF-TS-001-NVY-L', 'L', 'Navy', 15),
  -- 12. Men's Leather Belt
  ('b0000000-0000-4000-8000-000000000012', 'MF-AC-001-BRN-OS', 'One Size', 'Brown', 30),
  ('b0000000-0000-4000-8000-000000000012', 'MF-AC-001-BLK-OS', 'One Size', 'Black', 28)
on conflict (sku) do nothing;

-- ----------------------------------------------------------------------------
-- Coupon: WELCOME10 — 10% off, min order Rs 2,000, valid 90 days, 500 uses
-- ----------------------------------------------------------------------------
insert into public.coupons
  (code, discount_type, discount_value, min_order_amount, max_uses, used_count, valid_from, valid_until, is_active)
values
  ('WELCOME10', 'percentage', 10, 2000, 500, 0, now(), now() + interval '90 days', true)
on conflict (code) do nothing;
