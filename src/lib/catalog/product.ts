/**
 * Product detail view-model and variant selection logic. Pure module —
 * shared by the server page and the client purchase panel, unit-tested.
 */
import { z } from "@/lib/z";
import { AUDIENCES, type Audience } from "@/lib/domain";
import { sortSizes } from "./filters";

const money = z.union([z.number(), z.string()]).transform((v) => Number(v));

export const PRODUCT_DETAIL_SELECT =
  "id, slug, name, audience, description, details, base_price, compare_at_price, is_new_arrival, " +
  "category:categories(name, slug), " +
  "product_images(url, alt, sort_order), " +
  "product_variants(id, sku, size, color, color_hex, stock_quantity, price_override, sort_order)";

const detailRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  audience: z.enum(AUDIENCES),
  description: z.string(),
  details: z.array(z.string()),
  base_price: money,
  compare_at_price: money.nullable(),
  is_new_arrival: z.boolean(),
  category: z.object({ name: z.string(), slug: z.string() }).nullable(),
  product_images: z.array(z.object({ url: z.string(), alt: z.string(), sort_order: z.number() })),
  product_variants: z.array(
    z.object({
      id: z.string().uuid(),
      sku: z.string(),
      size: z.string(),
      color: z.string(),
      color_hex: z.string(),
      stock_quantity: z.number().int(),
      price_override: money.nullable(),
      sort_order: z.number(),
    }),
  ),
});

export interface Variant {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  price: number;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  audience: Audience;
  description: string;
  details: string[];
  basePrice: number;
  compareAtPrice: number | null;
  isNew: boolean;
  category: { name: string; slug: string } | null;
  images: Array<{ url: string; alt: string }>;
  variants: Variant[];
  colors: Array<{ name: string; hex: string; inStock: boolean }>;
  sizes: string[];
}

export function toProductDetail(raw: unknown): ProductDetail {
  const row = detailRowSchema.parse(raw);
  const variants = [...row.product_variants]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      colorHex: v.color_hex,
      stock: Math.max(0, v.stock_quantity),
      price: v.price_override ?? row.base_price,
    }));
  const colors: ProductDetail["colors"] = [];
  for (const v of variants) {
    const existing = colors.find((c) => c.name === v.color);
    if (existing) existing.inStock ||= v.stock > 0;
    else colors.push({ name: v.color, hex: v.colorHex, inStock: v.stock > 0 });
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    audience: row.audience,
    description: row.description,
    details: row.details,
    basePrice: row.base_price,
    compareAtPrice: row.compare_at_price,
    isNew: row.is_new_arrival,
    category: row.category,
    images: [...row.product_images]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ url: i.url, alt: i.alt || row.name })),
    variants,
    colors,
    sizes: sortSizes(Array.from(new Set(variants.map((v) => v.size)))),
  };
}

/* ------------------------------ selection -------------------------------- */

export function findVariant(product: ProductDetail, color: string | null, size: string | null): Variant | null {
  if (!color || !size) return null;
  return product.variants.find((v) => v.color === color && v.size === size) ?? null;
}

/** Stock of a size in the chosen colour (0 when the combination does not exist). */
export function sizeStock(product: ProductDetail, color: string | null, size: string): number {
  return product.variants.filter((v) => v.size === size && (color === null || v.color === color)).reduce((n, v) => n + v.stock, 0);
}

/**
 * Initial selection: URL values when valid; otherwise the first colour with
 * stock. A size is pre-selected only when the product has a single size.
 */
export function initialSelection(
  product: ProductDetail,
  requested: { color?: string | null; size?: string | null },
): { color: string | null; size: string | null } {
  const colorOk = requested.color && product.colors.some((c) => c.name === requested.color);
  const color = colorOk
    ? (requested.color as string)
    : (product.colors.find((c) => c.inStock)?.name ?? product.colors[0]?.name ?? null);
  const sizeOk = requested.size && product.variants.some((v) => v.color === color && v.size === requested.size);
  const size = sizeOk ? (requested.size as string) : product.sizes.length === 1 ? product.sizes[0] : null;
  return { color, size };
}

export type StockTone = "success" | "warning" | "danger" | "neutral";

/** Customer-facing stock line for the selected variant. */
export function stockMessage(variant: Variant | null, lowThreshold: number): { tone: StockTone; text: string } {
  if (!variant) return { tone: "neutral", text: "Select a size to see availability" };
  if (variant.stock <= 0) return { tone: "danger", text: "Sold out in this size" };
  if (variant.stock <= lowThreshold) return { tone: "warning", text: `Only ${variant.stock} left — order soon` };
  return { tone: "success", text: "In stock — ready to ship" };
}
