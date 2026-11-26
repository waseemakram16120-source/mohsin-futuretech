import "server-only";

import type { Audience } from "@/lib/domain";
import { createPublicClient } from "@/lib/supabase/public";
import { PAGE_SIZE, sortSizes, type ListingFilters } from "./filters";
import { PRODUCT_DETAIL_SELECT, toProductDetail, type ProductDetail } from "./product";
import {
  PRODUCT_CARD_SELECT,
  mergeSettings,
  toCategory,
  toProductCard,
  type Category,
  type ProductCardData,
  type StoreSettings,
} from "./mappers";

class CatalogError extends Error {
  constructor(context: string, cause: unknown) {
    super(`Could not load ${context}`, { cause });
    this.name = "CatalogError";
  }
}

/** Store settings; falls back to src/config/store.ts if the read fails. */
export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    const { data, error } = await createPublicClient()
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return mergeSettings(data);
  } catch (error) {
    console.error("[settings] falling back to config defaults", error);
    return mergeSettings(null);
  }
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id, name, slug, description, image_url, sort_order")
    .order("sort_order")
    .order("name");
  if (error) throw new CatalogError("categories", error);
  return (data ?? []).map(toCategory);
}

export interface ProductQuery {
  featured?: boolean;
  newArrivals?: boolean;
  onSale?: boolean;
  audience?: Audience;
  limit?: number;
}

export async function getProductCards(query: ProductQuery = {}): Promise<ProductCardData[]> {
  let request = createPublicClient().from("products").select(PRODUCT_CARD_SELECT);
  if (query.featured) request = request.eq("is_featured", true);
  if (query.newArrivals) request = request.eq("is_new_arrival", true);
  if (query.onSale) request = request.not("compare_at_price", "is", null);
  if (query.audience) request = request.eq("audience", query.audience);
  const { data, error } = await request
    .order("created_at", { ascending: false })
    .order("name")
    .limit(query.limit ?? 12);
  if (error) throw new CatalogError("products", error);
  return (data ?? []).map(toProductCard);
}

export async function countProducts(audience: Audience): Promise<number> {
  const { count, error } = await createPublicClient()
    .from("products")
    .select("id", { count: "exact", head: true })
    .in("audience", [audience, "unisex"]);
  if (error) throw new CatalogError("product counts", error);
  return count ?? 0;
}

/* ------------------------------- listings -------------------------------- */

export interface ListingScope {
  categorySlug?: string;
  audience?: Audience;
  onSale?: boolean;
  newOnly?: boolean;
}

export interface ListingResult {
  products: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
}

/** Cards for the given ids, in the same order (missing/inactive ids skipped). */
export async function getProductCardsByIds(ids: string[]): Promise<ProductCardData[]> {
  if (ids.length === 0) return [];
  const { data, error } = await createPublicClient().from("products").select(PRODUCT_CARD_SELECT).in("id", ids);
  if (error) throw new CatalogError("products", error);
  const byId = new Map((data ?? []).map((row) => {
    const card = toProductCard(row);
    return [card.id, card] as const;
  }));
  return ids.map((id) => byId.get(id)).filter((c): c is ProductCardData => c !== undefined);
}

export async function getListing(scope: ListingScope, filters: ListingFilters): Promise<ListingResult> {
  const { data, error } = await createPublicClient().rpc("catalog_search", {
    p_category_slug: scope.categorySlug ?? null,
    p_audience: scope.audience ?? null,
    p_query: filters.q || null,
    p_sizes: filters.sizes.length ? filters.sizes : null,
    p_colors: filters.colors.length ? filters.colors : null,
    p_min_price: filters.min,
    p_max_price: filters.max,
    p_in_stock: filters.inStock,
    p_on_sale: Boolean(scope.onSale || filters.onSale),
    p_new_only: Boolean(scope.newOnly),
    p_sort: filters.sort,
    p_limit: PAGE_SIZE,
    p_offset: (filters.page - 1) * PAGE_SIZE,
  });
  if (error) throw new CatalogError("product listing", error);
  const rows = (data ?? []) as Array<{ product_id: string; total_count: number }>;
  let total = rows.length ? Number(rows[0].total_count) : 0;

  // Past the last page there are no rows to read the total from.
  if (rows.length === 0 && filters.page > 1) {
    const firstPage = await getListing(scope, { ...filters, page: 1 });
    total = firstPage.total;
  }

  const products = await getProductCardsByIds(rows.map((r) => r.product_id));
  return { products, total, page: filters.page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export interface Facets {
  sizes: string[];
  colors: Array<{ name: string; hex: string }>;
  minPrice: number | null;
  maxPrice: number | null;
  total: number;
}

export async function getFacets(scope: ListingScope, q = ""): Promise<Facets> {
  const { data, error } = await createPublicClient().rpc("catalog_facets", {
    p_category_slug: scope.categorySlug ?? null,
    p_audience: scope.audience ?? null,
    p_query: q || null,
    p_on_sale: Boolean(scope.onSale),
    p_new_only: Boolean(scope.newOnly),
  });
  if (error) throw new CatalogError("filters", error);
  const f = (data ?? {}) as { sizes?: string[]; colors?: Facets["colors"]; min_price?: number | null; max_price?: number | null; total?: number };
  return {
    sizes: sortSizes(f.sizes ?? []),
    colors: f.colors ?? [],
    minPrice: f.min_price === null || f.min_price === undefined ? null : Number(f.min_price),
    maxPrice: f.max_price === null || f.max_price === undefined ? null : Number(f.max_price),
    total: f.total ?? 0,
  };
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id, name, slug, description, image_url, sort_order")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new CatalogError("category", error);
  return data ? toCategory(data) : null;
}

/* ------------------------------ product page ----------------------------- */

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const { data, error } = await createPublicClient()
    .from("products")
    .select(PRODUCT_DETAIL_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new CatalogError("product", error);
  return data ? toProductDetail(data) : null;
}

/** Up to `limit` other products from the same category (newest first). */
export async function getRelatedProducts(product: ProductDetail, limit = 4): Promise<ProductCardData[]> {
  if (!product.category) return [];
  const { data, error } = await createPublicClient().rpc("catalog_search", {
    p_category_slug: product.category.slug,
    p_sort: "featured",
    p_limit: limit + 1,
    p_offset: 0,
  });
  if (error) throw new CatalogError("related products", error);
  const ids = ((data ?? []) as Array<{ product_id: string }>).map((r) => r.product_id).filter((id) => id !== product.id);
  return getProductCardsByIds(ids.slice(0, limit));
}
