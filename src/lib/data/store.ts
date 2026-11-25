/**
 * Data-access layer for the storefront (Step 2).
 *
 * Tries Supabase first when env vars are configured (server-side, via the
 * existing Supabase server client), and falls back to the local seed data
 * in src/lib/data/{categories,products}.ts when Supabase is NOT configured
 * or a query fails — no live Supabase project exists yet, so the site MUST
 * work fully on the fallback. The build never breaks on missing env vars.
 *
 * SERVER ONLY: imports src/lib/supabase/server.ts ("server-only"). Only
 * import this module from Server Components / Route Handlers.
 */
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { LOCAL_CATEGORIES, type StoreCategory } from "./categories";
import {
  COLOR_HEX,
  LOCAL_PRODUCTS,
  type StoreProduct,
  type StoreVariant,
} from "./products";

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return (
    url.length > 0 &&
    !url.includes("placeholder") &&
    key.length > 0 &&
    !key.includes("placeholder")
  );
}

/* ------------------------------------------------------------------ */
/* Supabase row shapes (subset of the schema in supabase/schema.sql)  */
/* ------------------------------------------------------------------ */

interface SupabaseVariantRow {
  id: string;
  sku: string;
  size: string;
  color: string;
  stock_quantity: number;
  is_active: boolean;
}

interface SupabaseCategoryRow {
  name: string;
  slug: string;
}

interface SupabaseProductRow {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  compare_at_price: number | null;
  image_url: string | null;
  is_featured: boolean;
  is_new_arrival: boolean;
  is_active: boolean;
  product_variants: SupabaseVariantRow[] | null;
  categories: SupabaseCategoryRow | null;
}

interface SupabaseCategoryListRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

function mapProduct(row: SupabaseProductRow): StoreProduct {
  const local = LOCAL_PRODUCTS.find((p) => p.slug === row.slug);
  const variants: StoreVariant[] = (row.product_variants ?? [])
    .filter((v) => v.is_active)
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      colorHex: COLOR_HEX[v.color] ?? "#6b7280",
      stock: v.stock_quantity,
    }));
  return {
    id: row.id,
    categoryId: row.category_id ?? local?.categoryId ?? "",
    categorySlug: row.categories?.slug ?? local?.categorySlug ?? "",
    categoryName: row.categories?.name ?? local?.categoryName ?? "",
    name: row.name,
    slug: row.slug,
    description: row.description ?? local?.description ?? "",
    price: row.base_price,
    compareAtPrice: row.compare_at_price,
    // Supabase products carry a single image_url; the local catalogue
    // supplies the gallery. Prefer the stored image, then local images.
    images:
      row.image_url && local
        ? [row.image_url, ...local.images.filter((i) => i !== row.image_url)]
        : (local?.images ?? (row.image_url ? [row.image_url] : [])),
    isFeatured: row.is_featured,
    isNew: row.is_new_arrival,
    variants: variants.length > 0 ? variants : (local?.variants ?? []),
  };
}

async function fetchProductsFromSupabase(): Promise<StoreProduct[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, product_variants(*), categories(name, slug)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error || !data) return null;
    const products = (data as unknown as SupabaseProductRow[]).map(mapProduct);
    return products.length > 0 ? products : null;
  } catch {
    return null;
  }
}

async function fetchCategoriesFromSupabase(): Promise<StoreCategory[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error || !data) return null;
    const rows = data as unknown as SupabaseCategoryListRow[];
    const mapped = rows.map((row) => {
      const local = LOCAL_CATEGORIES.find((c) => c.slug === row.slug);
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description ?? local?.description ?? "",
        image: row.image_url ?? local?.image ?? "",
        sortOrder: row.sort_order,
      } satisfies StoreCategory;
    });
    return mapped.length > 0 ? mapped : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Public accessors — Supabase first, local seed fallback              */
/* ------------------------------------------------------------------ */

export async function getCategories(): Promise<StoreCategory[]> {
  return (await fetchCategoriesFromSupabase()) ?? LOCAL_CATEGORIES;
}

export async function getProducts(): Promise<StoreProduct[]> {
  return (await fetchProductsFromSupabase()) ?? LOCAL_PRODUCTS;
}

export async function getProductBySlug(
  slug: string,
): Promise<StoreProduct | null> {
  const products = await getProducts();
  return products.find((p) => p.slug === slug) ?? null;
}

export async function getProductsByCategory(
  categorySlug: string,
): Promise<StoreProduct[]> {
  const products = await getProducts();
  return products.filter((p) => p.categorySlug === categorySlug);
}

export async function getFeaturedProducts(): Promise<StoreProduct[]> {
  const products = await getProducts();
  return products.filter((p) => p.isFeatured);
}

export async function getNewArrivals(): Promise<StoreProduct[]> {
  const products = await getProducts();
  return products.filter((p) => p.isNew);
}

export async function getSaleProducts(): Promise<StoreProduct[]> {
  const products = await getProducts();
  return products.filter(
    (p) => p.compareAtPrice !== null && p.compareAtPrice > p.price,
  );
}

export async function searchProducts(query: string): Promise<StoreProduct[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const products = await getProducts();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.categoryName.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q),
  );
}

/* ------------------------------------------------------------------ */
/* Filtering & sorting live in ./catalog.ts (client-safe, pure).       */
/* Re-exported here so server pages can import everything from store. */
/* ------------------------------------------------------------------ */

export {
  allColors,
  allSizes,
  applyFilters,
  parseShopFilters,
  sortProducts,
  SORT_OPTIONS,
  type ShopFilters,
  type SortOption,
} from "./catalog";
