import "server-only";

import { z } from "@/lib/z";
import { couponMessage } from "@/lib/checkout/errors";
import { computeTotals, type Totals } from "@/lib/checkout/totals";
import { getStoreSettings } from "@/lib/catalog/queries";
import { createPublicClient } from "@/lib/supabase/public";

export type LineStatus = "ok" | "limited" | "out_of_stock" | "unavailable";

export interface QuoteLine {
  variantId: string;
  requested: number;
  /** Quantity that can actually be bought now (≤ stock). */
  quantity: number;
  stock: number;
  status: LineStatus;
  productName: string | null;
  productSlug: string | null;
  sku: string | null;
  size: string | null;
  color: string | null;
  image: { url: string; alt: string } | null;
  unitPrice: number;
  compareAtPrice: number | null;
}

export interface Quote {
  lines: QuoteLine[];
  totals: Totals;
  coupon: { code: string; valid: boolean; discount: number; message: string } | null;
  freeDeliveryMin: number;
  deliveryCharge: number;
  hasIssues: boolean;
}

const money = z.union([z.number(), z.string()]).transform(Number);
const variantRow = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  size: z.string(),
  color: z.string(),
  stock_quantity: z.number().int(),
  price_override: money.nullable(),
  product: z.object({
    name: z.string(),
    slug: z.string(),
    base_price: money,
    compare_at_price: money.nullable(),
    product_images: z.array(z.object({ url: z.string(), alt: z.string(), sort_order: z.number() })),
  }),
});

/**
 * Live quote for a bag: current price and stock of every line (uncached),
 * coupon check, and totals that mirror place_order(). Inactive products and
 * variants are invisible to the anon role, so they come back "unavailable".
 */
export async function quoteCart(items: Array<{ variantId: string; quantity: number }>, couponCode: string): Promise<Quote> {
  const supabase = createPublicClient({ cached: false });
  const settings = await getStoreSettings();
  const ids = Array.from(new Set(items.map((i) => i.variantId)));

  const rows = new Map<string, z.infer<typeof variantRow>>();
  if (ids.length) {
    const { data, error } = await supabase
      .from("product_variants")
      .select(
        "id, sku, size, color, stock_quantity, price_override, product:products!inner(name, slug, base_price, compare_at_price, product_images(url, alt, sort_order))",
      )
      .in("id", ids);
    if (error) throw new Error("Could not load bag items", { cause: error });
    for (const raw of data ?? []) {
      const row = variantRow.parse(raw);
      rows.set(row.id, row);
    }
  }

  const lines: QuoteLine[] = items.map((item) => {
    const row = rows.get(item.variantId);
    if (!row) {
      return {
        variantId: item.variantId, requested: item.quantity, quantity: 0, stock: 0, status: "unavailable",
        productName: null, productSlug: null, sku: null, size: null, color: null, image: null, unitPrice: 0, compareAtPrice: null,
      };
    }
    const stock = Math.max(0, row.stock_quantity);
    const quantity = Math.min(item.quantity, stock);
    const status: LineStatus = stock === 0 ? "out_of_stock" : quantity < item.quantity ? "limited" : "ok";
    const image = [...row.product.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
    return {
      variantId: row.id,
      requested: item.quantity,
      quantity,
      stock,
      status,
      productName: row.product.name,
      productSlug: row.product.slug,
      sku: row.sku,
      size: row.size,
      color: row.color,
      image: image ? { url: image.url, alt: image.alt || row.product.name } : null,
      unitPrice: row.price_override ?? row.product.base_price,
      compareAtPrice: row.product.compare_at_price,
    };
  });

  const purchasable = lines.filter((l) => l.quantity > 0);
  const base = computeTotals(purchasable, settings);

  let coupon: Quote["coupon"] = null;
  if (couponCode) {
    const { data, error } = await supabase.rpc("validate_coupon", { p_code: couponCode, p_subtotal: base.subtotal });
    if (error) throw new Error("Could not check coupon", { cause: error });
    const r = (data ?? {}) as { valid?: boolean; code?: string; discount?: number; error?: string; min_order_amount?: number };
    coupon = r.valid
      ? { code: r.code ?? couponCode, valid: true, discount: Number(r.discount ?? 0), message: `${r.code ?? couponCode} applied.` }
      : { code: couponCode, valid: false, discount: 0, message: couponMessage(r.error ?? "coupon_invalid", r.min_order_amount) };
  }

  return {
    lines,
    totals: computeTotals(purchasable, settings, coupon?.valid ? coupon.discount : 0),
    coupon,
    freeDeliveryMin: settings.freeDeliveryMin,
    deliveryCharge: settings.deliveryCharge,
    hasIssues: lines.some((l) => l.status !== "ok"),
  };
}
