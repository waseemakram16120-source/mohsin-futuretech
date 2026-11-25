/**
 * Server-side catalogue for order validation (Step 3).
 *
 * SERVER ONLY. The orders API route must never trust client-sent prices
 * or stock — it re-prices every line from this catalogue and re-checks
 * stock here. Supabase (via the service-role admin client) is the source
 * of truth when configured; the local seed catalogue is the fallback.
 */
import "server-only";

import { isSupabaseConfigured } from "@/lib/data/store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { LOCAL_PRODUCTS } from "@/lib/data/products";

export interface ServerVariant {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  image: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  stock: number;
}

export async function getServerCatalogue(): Promise<ServerVariant[]> {
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("products")
        .select("id, slug, name, base_price, image_url, product_variants(id, sku, size, color, price_override, stock_quantity, is_active)")
        .eq("is_active", true);
      if (!error && data && data.length > 0) {
        const rows = data as unknown as Array<{
          id: string;
          slug: string;
          name: string;
          base_price: number;
          image_url: string | null;
          product_variants: Array<{
            id: string;
            sku: string;
            size: string;
            color: string;
            price_override: number | null;
            stock_quantity: number;
            is_active: boolean;
          }> | null;
        }>;
        const variants: ServerVariant[] = [];
        for (const product of rows) {
          const local = LOCAL_PRODUCTS.find((p) => p.slug === product.slug);
          for (const v of product.product_variants ?? []) {
            if (!v.is_active) continue;
            variants.push({
              variantId: v.id,
              productId: product.id,
              productSlug: product.slug,
              productName: product.name,
              image: product.image_url ?? local?.images[0] ?? "",
              sku: v.sku,
              size: v.size,
              color: v.color,
              price: v.price_override ?? product.base_price,
              stock: v.stock_quantity,
            });
          }
        }
        if (variants.length > 0) return variants;
      }
    } catch {
      // Fall through to the local catalogue.
    }
  }
  return LOCAL_PRODUCTS.flatMap((product) =>
    product.variants.map((v) => ({
      variantId: v.id,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      image: product.images[0] ?? "",
      sku: v.sku,
      size: v.size,
      color: v.color,
      price: product.price,
      stock: v.stock,
    })),
  );
}

/** Validate a coupon code server-side. Supabase first, local rule fallback. */
export async function validateCouponServer(
  rawCode: string,
  subtotal: number,
): Promise<{ valid: boolean; discount: number; message: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, discount: 0, message: "" };
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("coupons")
        .select("discount_type, discount_value, min_order_amount, max_uses, used_count, valid_from, valid_until, is_active")
        .eq("code", code)
        .single();
      if (!error && data) {
        const row = data as unknown as {
          discount_type: string;
          discount_value: number;
          min_order_amount: number;
          max_uses: number | null;
          used_count: number;
          valid_from: string | null;
          valid_until: string | null;
          is_active: boolean;
        };
        const now = new Date();
        if (!row.is_active) return { valid: false, discount: 0, message: "This coupon is no longer active." };
        if (row.valid_from && new Date(row.valid_from) > now)
          return { valid: false, discount: 0, message: "This coupon is not valid yet." };
        if (row.valid_until && new Date(row.valid_until) < now)
          return { valid: false, discount: 0, message: "This coupon has expired." };
        if (row.max_uses !== null && row.used_count >= row.max_uses)
          return { valid: false, discount: 0, message: "This coupon has been used up." };
        if (subtotal < row.min_order_amount)
          return {
            valid: false,
            discount: 0,
            message: `This coupon needs a minimum order of Rs ${row.min_order_amount.toLocaleString("en-PK")}.`,
          };
        const discount =
          row.discount_type === "percentage"
            ? Math.round((subtotal * row.discount_value) / 100)
            : Math.min(row.discount_value, subtotal);
        return { valid: true, discount, message: `${code} applied.` };
      }
      // Unknown code in Supabase — fall through to the local WELCOME10 rule
      // so a seeded-but-not-yet-synced coupon still works.
    } catch {
      // Fall through to the local rule.
    }
  }
  if (code === "WELCOME10") {
    if (subtotal < 2000) {
      return { valid: false, discount: 0, message: "WELCOME10 needs a minimum order of Rs 2,000." };
    }
    return { valid: true, discount: Math.round(subtotal * 0.1), message: "WELCOME10 applied — 10% off." };
  }
  return { valid: false, discount: 0, message: "This coupon code is not valid." };
}
