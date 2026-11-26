/**
 * Row → view-model mapping for catalogue data, validated with Zod so a
 * schema drift fails loudly instead of rendering "undefined". Pure module:
 * no server-only imports, so it is unit-tested directly.
 */
import { z } from "zod";
import { AUDIENCES, type Audience } from "@/lib/domain";
import { storeConfig } from "@/config/store";

const money = z.union([z.number(), z.string()]).transform((v) => Number(v));

export const productRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  audience: z.enum(AUDIENCES),
  base_price: money,
  compare_at_price: money.nullable(),
  is_featured: z.boolean(),
  is_new_arrival: z.boolean(),
  created_at: z.string(),
  category: z.object({ name: z.string(), slug: z.string() }).nullable(),
  product_images: z.array(z.object({ url: z.string(), alt: z.string(), sort_order: z.number() })),
  product_variants: z.array(
    z.object({
      size: z.string(),
      color: z.string(),
      color_hex: z.string(),
      stock_quantity: z.number(),
      price_override: money.nullable(),
      sort_order: z.number(),
    }),
  ),
});
export type ProductRow = z.input<typeof productRowSchema>;

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  audience: Audience;
  categoryName: string | null;
  categorySlug: string | null;
  /** Lowest selling price across variants. */
  price: number;
  /** True when variants have different prices ("From Rs …"). */
  priceVaries: boolean;
  compareAtPrice: number | null;
  image: { url: string; alt: string } | null;
  hoverImage: { url: string; alt: string } | null;
  isNew: boolean;
  isFeatured: boolean;
  inStock: boolean;
  /** Sizes that have stock, in display order. */
  sizesInStock: string[];
  colors: Array<{ name: string; hex: string }>;
}

export const PRODUCT_CARD_SELECT =
  "id, slug, name, audience, base_price, compare_at_price, is_featured, is_new_arrival, created_at, " +
  "category:categories(name, slug), " +
  "product_images(url, alt, sort_order), " +
  "product_variants(size, color, color_hex, stock_quantity, price_override, sort_order)";

export function toProductCard(raw: unknown): ProductCardData {
  const row = productRowSchema.parse(raw);
  const images = [...row.product_images].sort((a, b) => a.sort_order - b.sort_order);
  const variants = [...row.product_variants].sort((a, b) => a.sort_order - b.sort_order);

  const prices = variants.map((v) => v.price_override ?? row.base_price);
  const price = prices.length ? Math.min(...prices) : row.base_price;

  const sizesInStock: string[] = [];
  const colors: Array<{ name: string; hex: string }> = [];
  for (const v of variants) {
    if (v.stock_quantity > 0 && !sizesInStock.includes(v.size)) sizesInStock.push(v.size);
    if (!colors.some((c) => c.name === v.color)) colors.push({ name: v.color, hex: v.color_hex });
  }

  const alt = (i: { alt: string } | undefined) => i?.alt || row.name;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    audience: row.audience,
    categoryName: row.category?.name ?? null,
    categorySlug: row.category?.slug ?? null,
    price,
    priceVaries: new Set(prices).size > 1,
    compareAtPrice: row.compare_at_price,
    image: images[0] ? { url: images[0].url, alt: alt(images[0]) } : null,
    hoverImage: images[1] ? { url: images[1].url, alt: alt(images[1]) } : null,
    isNew: row.is_new_arrival,
    isFeatured: row.is_featured,
    inStock: sizesInStock.length > 0,
    sizesInStock,
    colors,
  };
}

/* ------------------------------- categories ------------------------------ */

export const categoryRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  sort_order: z.number(),
});
export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
};

export function toCategory(raw: unknown): Category {
  const row = categoryRowSchema.parse(raw);
  return { id: row.id, name: row.name, slug: row.slug, description: row.description, imageUrl: row.image_url };
}

/* ------------------------------ store settings --------------------------- */

const settingsRowSchema = z
  .object({
    store_name: z.string().nullable(),
    support_phone: z.string().nullable(),
    support_email: z.string().nullable(),
    whatsapp_number: z.string().nullable(),
    store_address: z.string().nullable(),
    delivery_charge: money,
    free_delivery_min: money,
    low_stock_threshold: z.number(),
    easypaisa_account_name: z.string().nullable(),
    easypaisa_account_number: z.string().nullable(),
    jazzcash_account_name: z.string().nullable(),
    jazzcash_account_number: z.string().nullable(),
    nayapay_account_name: z.string().nullable(),
    nayapay_account_number: z.string().nullable(),
  })
  .partial();

export interface StoreSettings {
  storeName: string;
  phone: string;
  email: string;
  whatsapp: string;
  address: string;
  deliveryCharge: number;
  freeDeliveryMin: number;
  lowStockThreshold: number;
  wallets: Record<"easypaisa" | "jazzcash" | "nayapay", { accountName: string | null; accountNumber: string | null }>;
}

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Database settings win; src/config/store.ts fills any gaps. */
export function mergeSettings(raw: unknown): StoreSettings {
  const row = raw ? settingsRowSchema.parse(raw) : {};
  return {
    storeName: blank(row.store_name) ?? storeConfig.name,
    phone: blank(row.support_phone) ?? storeConfig.contact.phone,
    email: blank(row.support_email) ?? storeConfig.contact.email,
    whatsapp: blank(row.whatsapp_number) ?? storeConfig.contact.whatsapp,
    address: blank(row.store_address) ?? storeConfig.contact.address,
    deliveryCharge: row.delivery_charge ?? storeConfig.delivery.charge,
    freeDeliveryMin: row.free_delivery_min ?? storeConfig.delivery.freeDeliveryMin,
    lowStockThreshold: row.low_stock_threshold ?? storeConfig.inventory.lowStockThreshold,
    wallets: {
      easypaisa: { accountName: blank(row.easypaisa_account_name), accountNumber: blank(row.easypaisa_account_number) },
      jazzcash: { accountName: blank(row.jazzcash_account_name), accountNumber: blank(row.jazzcash_account_number) },
      nayapay: { accountName: blank(row.nayapay_account_name), accountNumber: blank(row.nayapay_account_number) },
    },
  };
}
