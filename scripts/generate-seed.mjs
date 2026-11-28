#!/usr/bin/env node
/**
 * Generates the sample catalogue for development and testing:
 *   - supabase/seed.sql            (categories, products, variants, coupons, settings)
 *   - public/placeholders/*.svg    (original, lightweight garment placeholders)
 *
 * Run:  node scripts/generate-seed.mjs
 * The output is committed; re-run after editing the data below.
 * Placeholder images are replaced by real photos from Admin → Products.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* --------------------------------- data --------------------------------- */

const categories = [
  { slug: "jackets", name: "Jackets", code: "JKT", shape: "jacket", sort: 1,
    description: "Puffers, denim, suede and outerwear for every season." },
  { slug: "jeans", name: "Jeans", code: "JNS", shape: "pants", sort: 2,
    description: "Slim, straight and wide-leg denim in stretch and rigid fabrics." },
  { slug: "shirts", name: "Shirts", code: "SHT", shape: "shirt", sort: 3,
    description: "Oxford, linen and printed shirts for work and weekends." },
  { slug: "trousers", name: "Trousers", code: "TRS", shape: "pants", sort: 4,
    description: "Chinos and tailored trousers with a clean finish." },
  { slug: "accessories", name: "Accessories", code: "ACC", shape: "belt", sort: 5,
    description: "Belts, caps and wallets to complete the look." },
];

const COLORS = {
  Black: "#1F1F1F", Olive: "#5B6236", Tan: "#B07A4A", Brown: "#6B4226",
  "Light Blue": "#9DB7D5", Indigo: "#2E3F6E", Beige: "#D8C8AE", "Mid Blue": "#5A7BA8",
  "Dark Blue": "#22324F", White: "#F4F4F2", "Sky Blue": "#A9C8E8", Sand: "#CDB894",
  Ivory: "#EFE8D8", "Blue Stripe": "#6F8FBF", Khaki: "#B9A57A", Navy: "#1E2A44",
  Cream: "#EDE3CC",
};

const TOPS = ["S", "M", "L", "XL"];
const MEN_WAIST = ["30", "32", "34", "36"];
const WOMEN_WAIST = ["26", "28", "30", "32"];

const products = [
  { slug: "mens-quilted-puffer-jacket", name: "Men's Quilted Puffer Jacket", category: "jackets",
    audience: "men", price: 7999, compare: 9999, featured: true, isNew: true,
    sizes: TOPS, colors: ["Black", "Olive"],
    description: "A lightweight quilted puffer with a water-repellent shell and a warm synthetic fill — built for Pakistani winters without the bulk.",
    details: ["Water-repellent nylon shell", "Synthetic down-alternative fill", "Two zip hand pockets", "Regular fit"] },
  { slug: "mens-suede-trucker-jacket", name: "Men's Suede Trucker Jacket", category: "jackets",
    audience: "men", price: 11999, featured: true,
    sizes: TOPS, colors: ["Tan", "Brown"],
    description: "A classic trucker silhouette in soft faux suede with button chest pockets and an easy, layered fit.",
    details: ["Faux suede outer", "Satin lining", "Button front and cuffs", "Regular fit"] },
  { slug: "womens-cropped-denim-jacket", name: "Women's Cropped Denim Jacket", category: "jackets",
    audience: "women", price: 6499, compare: 7999, isNew: true,
    sizes: TOPS, colors: ["Light Blue", "Indigo"],
    description: "A cropped denim jacket with a boxy shape that pairs with high-rise jeans and dresses alike.",
    details: ["100% cotton denim", "Cropped boxy fit", "Metal shank buttons"] },
  { slug: "womens-belted-trench-coat", name: "Women's Belted Trench Coat", category: "jackets",
    audience: "women", price: 12999, featured: true,
    sizes: TOPS, colors: ["Beige", "Black"],
    description: "A double-breasted trench with a removable belt, storm flap and a fluid drape.",
    details: ["Cotton-blend gabardine", "Removable waist belt", "Double-breasted front", "Relaxed fit"] },
  { slug: "mens-slim-fit-stretch-jeans", name: "Men's Slim Fit Stretch Jeans", category: "jeans",
    audience: "men", price: 4499, featured: true,
    sizes: MEN_WAIST, colors: ["Indigo", "Black"],
    description: "Slim through the hip and thigh with a tapered leg and just enough stretch for all-day comfort.",
    details: ["98% cotton, 2% elastane", "Slim tapered fit", "Five-pocket styling"] },
  { slug: "mens-relaxed-straight-jeans", name: "Men's Relaxed Straight Jeans", category: "jeans",
    audience: "men", price: 3999, compare: 4999,
    sizes: MEN_WAIST, colors: ["Mid Blue"],
    description: "An easy straight leg with room through the seat, washed for a soft, worn-in hand feel.",
    details: ["100% cotton denim", "Relaxed straight fit", "Stone wash"] },
  { slug: "womens-high-rise-skinny-jeans", name: "Women's High-Rise Skinny Jeans", category: "jeans",
    audience: "women", price: 3999, isNew: true,
    sizes: WOMEN_WAIST, colors: ["Dark Blue", "Black"],
    description: "A sculpting high rise and a skinny leg in recovery stretch denim that keeps its shape.",
    details: ["High rise", "Skinny fit", "Recovery stretch denim"] },
  { slug: "womens-wide-leg-jeans", name: "Women's Wide-Leg Jeans", category: "jeans",
    audience: "women", price: 4299,
    sizes: WOMEN_WAIST, colors: ["Light Blue"],
    description: "A fluid wide leg with a high waist and a full-length hem, cut from soft rigid denim.",
    details: ["High waist", "Wide leg", "100% cotton"] },
  { slug: "mens-oxford-button-down-shirt", name: "Men's Oxford Button-Down Shirt", category: "shirts",
    audience: "men", price: 2999, featured: true,
    sizes: TOPS, colors: ["White", "Sky Blue"],
    description: "A wardrobe staple in breathable oxford cotton with a button-down collar.",
    details: ["100% cotton oxford", "Button-down collar", "Regular fit"] },
  { slug: "mens-linen-blend-shirt", name: "Men's Linen Blend Shirt", category: "shirts",
    audience: "men", price: 3499, compare: 4299, isNew: true,
    sizes: TOPS, colors: ["Sand", "Olive"],
    description: "A breezy linen-cotton shirt made for hot afternoons, with a relaxed camp collar.",
    details: ["55% linen, 45% cotton", "Camp collar", "Relaxed fit"] },
  { slug: "womens-satin-blouse", name: "Women's Satin Blouse", category: "shirts",
    audience: "women", price: 3299, isNew: true,
    sizes: TOPS, colors: ["Ivory", "Black"],
    description: "A softly draped satin blouse with a concealed placket for a clean, polished finish.",
    details: ["Satin weave", "Concealed button placket", "Relaxed fit"] },
  { slug: "womens-striped-cotton-shirt", name: "Women's Striped Cotton Shirt", category: "shirts",
    audience: "women", price: 2799, compare: 3499,
    sizes: TOPS, colors: ["Blue Stripe"],
    description: "A crisp striped shirt with an oversized fit and dropped shoulders.",
    details: ["100% cotton poplin", "Oversized fit", "Curved hem"] },
  { slug: "mens-chino-trousers", name: "Men's Chino Trousers", category: "trousers",
    audience: "men", price: 3299,
    sizes: MEN_WAIST, colors: ["Khaki", "Navy"],
    description: "Smart-casual chinos with a slim leg and a soft brushed finish.",
    details: ["Cotton twill with stretch", "Slim fit", "Slanted side pockets"] },
  { slug: "womens-pleated-wide-trousers", name: "Women's Pleated Wide Trousers", category: "trousers",
    audience: "women", price: 3799, featured: true,
    sizes: WOMEN_WAIST, colors: ["Black", "Cream"],
    description: "High-waisted pleated trousers with a wide leg that moves beautifully.",
    details: ["Front pleats", "High waist", "Wide leg"] },
  { slug: "leather-belt", name: "Leather Belt", category: "accessories",
    audience: "unisex", price: 1999, shape: "belt",
    sizes: ["32", "34", "36", "38"], colors: ["Brown", "Black"],
    description: "A full-grain leather belt with a brushed metal buckle.",
    details: ["Full-grain leather", "Brushed metal buckle", "3.5 cm width"] },
  { slug: "canvas-baseball-cap", name: "Canvas Baseball Cap", category: "accessories",
    audience: "unisex", price: 1299, isNew: true, shape: "cap",
    sizes: ["One Size"], colors: ["Black", "Navy", "Beige"],
    description: "A six-panel cotton canvas cap with an adjustable strap.",
    details: ["Cotton canvas", "Adjustable back strap", "Curved brim"] },
  { slug: "leather-bifold-wallet", name: "Leather Bifold Wallet", category: "accessories",
    audience: "men", price: 2499, compare: 2999, shape: "wallet",
    sizes: ["One Size"], colors: ["Brown", "Black"],
    description: "A slim bifold wallet with six card slots and a full-length note pocket.",
    details: ["Genuine leather", "Six card slots", "Slim profile"] },
  // Inactive product: must never be visible to shoppers (RLS test).
  { slug: "archived-bomber-jacket", name: "Archived Bomber Jacket", category: "jackets",
    audience: "men", price: 6999, active: false,
    sizes: ["M"], colors: ["Olive"],
    description: "Discontinued style kept for order history.", details: [] },
];

const coupons = [
  { code: "WELCOME10", type: "percentage", value: 10, min: 2000, description: "10% off your first order (min. Rs 2,000)" },
  { code: "FLAT500", type: "fixed", value: 500, min: 4000, maxUses: 100, description: "Rs 500 off orders of Rs 4,000 or more" },
  { code: "EXPIRED20", type: "percentage", value: 20, min: 0, until: "2025-01-01T00:00:00Z", description: "Expired sample coupon" },
];

/* ------------------------------ helpers -------------------------------- */

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (items) => `array[${items.map(q).join(", ")}]::text[]`;
const code = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 4);
/**
 * Stable ids (md5 of a namespaced key) so re-seeding gives every row the same
 * id: cached pages, bags and wishlists stay valid across `supabase db reset`.
 */
// Version/variant nibbles are forced so the ids are valid RFC 4122 v4 UUIDs.
const sid = (kind, key) => `overlay(overlay(md5(${q(`${kind}:${key}`)}) placing '4' from 13) placing '8' from 17)::uuid`;

/** Deterministic stock: a mix of healthy, low (≤5) and sold-out variants. */
function stockFor(pIndex, vIndex) {
  const pattern = [12, 8, 20, 3, 15, 0, 9, 25, 5, 18, 2, 30];
  return pattern[(pIndex * 3 + vIndex) % pattern.length];
}

/* ---------------------------- placeholders ----------------------------- */

const SHAPES = {
  jacket:
    "M190 230 L255 195 Q300 235 345 195 L410 230 L505 360 L455 395 L425 350 L425 650 L175 650 L175 350 L145 395 L95 360 Z",
  shirt:
    "M195 225 L260 195 L300 245 L340 195 L405 225 L490 330 L445 365 L420 335 L420 640 L180 640 L180 335 L155 365 L110 330 Z",
  pants: "M200 175 L400 175 L425 660 L335 660 L300 345 L265 660 L175 660 Z",
  belt: "M110 380 L490 380 L490 430 L110 430 Z",
  cap: "M170 430 Q170 270 300 260 Q430 270 430 430 Z M300 430 L470 430 Q470 470 400 470 L300 470 Z",
  wallet: "M170 300 L430 300 Q450 300 450 320 L450 500 Q450 520 430 520 L170 520 Q150 520 150 500 L150 320 Q150 300 170 300 Z",
};

const DETAILS = {
  jacket: '<path d="M300 240 L300 650" stroke="#00000033" stroke-width="4"/>',
  shirt: [270, 330, 390, 450, 510].map((y) => `<circle cx="300" cy="${y}" r="6" fill="#00000040"/>`).join(""),
  pants: '<path d="M200 215 L400 215" stroke="#00000033" stroke-width="4"/>',
  belt: '<rect x="380" y="368" width="70" height="74" rx="6" fill="none" stroke="#C9C2B4" stroke-width="10"/>',
  cap: "",
  wallet: '<path d="M150 380 L450 380" stroke="#00000033" stroke-width="4"/>',
};

function placeholderSvg(shape, hex, variant) {
  const bg = variant === 1 ? "#EEEAE3" : "#E4DED4";
  const label = variant === 1 ? "" : '<rect x="0" y="740" width="600" height="60" fill="#00000008"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800" role="img"><rect width="600" height="800" fill="${bg}"/>${label}<g transform="${variant === 1 ? "" : "translate(300 400) scale(0.92) translate(-300 -400)"}"><path d="${SHAPES[shape]}" fill="${hex}" stroke="#00000022" stroke-width="3" stroke-linejoin="round"/>${DETAILS[shape]}</g></svg>\n`;
}

/* ------------------------------- output -------------------------------- */

const imgDir = join(root, "public", "placeholders");
mkdirSync(imgDir, { recursive: true });

const sql = [];
sql.push(`-- ============================================================================
-- Mohsin FutureTech — SAMPLE DATA for development and testing.
-- GENERATED by scripts/generate-seed.mjs — edit that file, not this one.
-- Safe to re-run (inserts skip existing rows). Do NOT load into the client's
-- production project unless they want the sample catalogue.
-- ============================================================================
`);

sql.push(`-- Store settings (placeholders — replace in Admin → Settings)
update public.store_settings set
  store_name = 'Mohsin FutureTech',
  support_phone = '+92 300 0000000',
  support_email = 'support@example.com',
  whatsapp_number = '923000000000',
  store_address = 'Shop address, Karachi, Pakistan',
  delivery_charge = 250,
  free_delivery_min = 5000,
  low_stock_threshold = 5,
  easypaisa_account_name = 'PLACEHOLDER — set in Admin Settings',
  easypaisa_account_number = '03XX-XXXXXXX',
  jazzcash_account_name = 'PLACEHOLDER — set in Admin Settings',
  jazzcash_account_number = '03XX-XXXXXXX',
  nayapay_account_name = 'PLACEHOLDER — set in Admin Settings',
  nayapay_account_number = '03XX-XXXXXXX'
where id = 1;
`);

sql.push("-- Categories");
for (const c of categories) {
  const img = `/placeholders/category-${c.slug}.svg`;
  writeFileSync(join(imgDir, `category-${c.slug}.svg`), placeholderSvg(c.shape, "#3B4252", 1));
  sql.push(
    `insert into public.categories (id, name, slug, description, image_url, sort_order) values (${sid("category", c.slug)}, ${q(c.name)}, ${q(c.slug)}, ${q(c.description)}, ${q(img)}, ${c.sort}) on conflict (slug) do nothing;`,
  );
}
sql.push("");

const skus = new Set();
products.forEach((p, pIndex) => {
  const cat = categories.find((c) => c.slug === p.category);
  const shape = p.shape ?? cat.shape;
  const n = String(pIndex + 1).padStart(3, "0");
  sql.push(`-- ${p.name}`);
  sql.push(
    `insert into public.products (id, category_id, audience, name, slug, description, details, base_price, compare_at_price, is_active, is_featured, is_new_arrival)
select ${sid("product", p.slug)}, id, ${q(p.audience)}, ${q(p.name)}, ${q(p.slug)}, ${q(p.description)}, ${arr(p.details)}, ${p.price}, ${p.compare ?? "null"}, ${p.active === false ? "false" : "true"}, ${p.featured ? "true" : "false"}, ${p.isNew ? "true" : "false"}
from public.categories where slug = ${q(p.category)}
on conflict (slug) do nothing;`,
  );

  const mainHex = COLORS[p.colors[0]];
  [1, 2].forEach((v) => {
    const file = `${p.slug}-${v}.svg`;
    writeFileSync(join(imgDir, file), placeholderSvg(shape, mainHex, v));
    sql.push(
      `insert into public.product_images (id, product_id, url, alt, sort_order)
select ${sid("image", file)}, id, ${q(`/placeholders/${file}`)}, ${q(`${p.name}${v === 2 ? " — alternate view" : ""}`)}, ${v - 1}
from public.products where slug = ${q(p.slug)}
  and not exists (select 1 from public.product_images i join public.products pp on pp.id = i.product_id where pp.slug = ${q(p.slug)} and i.sort_order = ${v - 1});`,
    );
  });

  let vIndex = 0;
  p.colors.forEach((color, ci) => {
    p.sizes.forEach((size, si) => {
      const sku = `${cat.code}-${n}-${code(size)}-${code(color)}`;
      if (skus.has(sku)) throw new Error(`Duplicate SKU ${sku}`);
      skus.add(sku);
      const stock = stockFor(pIndex, vIndex++);
      sql.push(
        `insert into public.product_variants (id, product_id, sku, size, color, color_hex, stock_quantity, sort_order)
select ${sid("variant", sku)}, id, ${q(sku)}, ${q(size)}, ${q(color)}, ${q(COLORS[color])}, ${stock}, ${ci * 100 + si}
from public.products where slug = ${q(p.slug)}
on conflict (sku) do nothing;`,
      );
    });
  });
  sql.push("");
});

sql.push("-- Coupons");
for (const c of coupons) {
  sql.push(
    `insert into public.coupons (id, code, description, discount_type, discount_value, min_order_amount, max_uses, valid_until) values (${sid("coupon", c.code)}, ${q(c.code)}, ${q(c.description)}, ${q(c.type)}, ${c.value}, ${c.min}, ${c.maxUses ?? "null"}, ${c.until ? q(c.until) : "null"}) on conflict (code) do nothing;`,
  );
}

writeFileSync(join(root, "supabase", "seed.sql"), sql.join("\n") + "\n");
console.log(
  `Wrote supabase/seed.sql: ${categories.length} categories, ${products.length} products, ${skus.size} variants, ${coupons.length} coupons; placeholders in public/placeholders/`,
);
