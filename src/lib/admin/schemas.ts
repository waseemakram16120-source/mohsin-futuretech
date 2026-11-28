/**
 * Admin form validation (Zod), shared by the browser and the Server
 * Actions. The database re-checks every constraint.
 */
import { z } from "@/lib/z";
import { AUDIENCES, DISCOUNT_TYPES } from "@/lib/domain";
import { normalizePkPhone } from "@/lib/checkout/phone";

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

const trimmed = (min: number, max: number, msg: string) =>
  z.string().transform((s) => s.replace(/\s+/g, " ").trim()).pipe(z.string().min(min, msg).max(max, `Keep it under ${max} characters.`));

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes only, e.g. slim-fit-jeans.").max(80));

const price = (label: string) =>
  z.coerce.number({ error: `Enter the ${label}.` }).refine((n) => Number.isFinite(n) && n > 0, `Enter the ${label}.`).refine((n) => n <= 10_000_000, "That price is too high.").transform((n) => Math.round(n * 100) / 100);

const optionalPrice = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100))
  .refine((v) => v === null || (Number.isFinite(v) && v > 0), "Must be more than 0, or leave it empty.");

export const variantInputSchema = z.object({
  id: z.string().uuid().nullable().default(null),
  size: trimmed(1, 20, "Enter a size."),
  color: trimmed(1, 40, "Enter a colour."),
  colorHex: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a colour, e.g. #1F2937."),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.string().regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, "SKU: capital letters, numbers and dashes, e.g. JNS-SLIM-32-BLU.").max(60)),
  priceOverride: optionalPrice,
  /** Only for NEW variants; existing stock changes go through Inventory (audited). */
  stock: z.coerce.number().int("Whole numbers only.").min(0, "Stock can't be negative.").max(100000).default(0),
  isActive: z.boolean().default(true),
});
export type VariantInput = z.infer<typeof variantInputSchema>;

export const productInputSchema = z
  .object({
    name: trimmed(2, 120, "Enter the product name."),
    slug,
    categoryId: z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null),
    audience: z.enum(AUDIENCES),
    description: z.string().trim().max(5000, "Description is too long."),
    details: z
      .string()
      .transform((s) => s.split("\n").map((l) => l.trim()).filter(Boolean))
      .pipe(z.array(z.string().max(200, "Each detail line must be under 200 characters.")).max(20, "Up to 20 detail lines.")),
    basePrice: price("price"),
    compareAtPrice: optionalPrice,
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    isNewArrival: z.boolean(),
    variants: z.array(variantInputSchema).min(1, "Add at least one size / colour.").max(60),
  })
  .superRefine((p, ctx) => {
    if (p.compareAtPrice !== null && p.compareAtPrice <= p.basePrice) {
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "The 'was' price must be higher than the price (or leave it empty)." });
    }
    const combos = new Set<string>();
    const skus = new Set<string>();
    p.variants.forEach((v, i) => {
      const key = `${v.size.toLowerCase()}|${v.color.toLowerCase()}`;
      if (combos.has(key)) ctx.addIssue({ code: "custom", path: ["variants", i, "size"], message: "This size + colour is listed twice." });
      combos.add(key);
      if (skus.has(v.sku)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "This SKU is used twice." });
      skus.add(v.sku);
    });
  });
export type ProductInput = z.infer<typeof productInputSchema>;

export const categoryInputSchema = z.object({
  id: z.string().uuid().nullable().default(null),
  name: trimmed(2, 60, "Enter a category name."),
  slug,
  description: z.string().trim().max(500, "Keep it under 500 characters."),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
  isActive: z.boolean(),
});

export const couponInputSchema = z
  .object({
    id: z.string().uuid().nullable().default(null),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .pipe(z.string().regex(/^[A-Z0-9]{3,30}$/, "3–30 capital letters or numbers, e.g. EID25.")),
    description: z.string().trim().max(200),
    discountType: z.enum(DISCOUNT_TYPES),
    discountValue: z.coerce.number().refine((n) => n > 0, "Enter the discount."),
    minOrderAmount: z.coerce.number().min(0, "Can't be negative.").default(0),
    maxUses: z
      .union([z.literal(""), z.coerce.number().int().min(1, "At least 1, or leave empty for unlimited.")])
      .transform((v) => (v === "" ? null : v)),
    validFrom: z.string().trim().transform((v) => v || null),
    validUntil: z.string().trim().transform((v) => v || null),
    isActive: z.boolean(),
  })
  .superRefine((c, ctx) => {
    if (c.discountType === "percentage" && c.discountValue > 90) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Percentage discounts can be at most 90%." });
    }
    if (c.validFrom && c.validUntil && c.validUntil <= c.validFrom) {
      ctx.addIssue({ code: "custom", path: ["validUntil"], message: "The end date must be after the start date." });
    }
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters.`)
    .transform((v) => v || null);

export const settingsInputSchema = z.object({
  storeName: trimmed(2, 80, "Enter the store name."),
  supportPhone: optionalText(40),
  supportEmail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.union([z.literal(""), z.email("Enter a valid email or leave it empty.")]))
    .transform((v) => v || null),
  whatsapp: z.string().transform((s, ctx) => {
    if (!s.trim()) return null;
    const local = normalizePkPhone(s);
    if (!local) {
      ctx.addIssue({ code: "custom", message: "Enter a Pakistani mobile number, e.g. 0300 1234567." });
      return z.NEVER;
    }
    return `92${local.slice(1)}`; // wa.me format
  }),
  storeAddress: optionalText(200),
  deliveryCharge: z.coerce.number().min(0, "Can't be negative.").max(100000),
  freeDeliveryMin: z.coerce.number().min(0, "Can't be negative.").max(10_000_000),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000),
  easypaisaName: optionalText(80),
  easypaisaNumber: optionalText(40),
  jazzcashName: optionalText(80),
  jazzcashNumber: optionalText(40),
});

export function firstIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
