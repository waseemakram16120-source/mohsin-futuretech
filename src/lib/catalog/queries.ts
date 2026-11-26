import "server-only";

import type { Audience } from "@/lib/domain";
import { createPublicClient } from "@/lib/supabase/public";
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
