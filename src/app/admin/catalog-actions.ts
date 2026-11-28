"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { adminActionError } from "@/lib/admin/auth";
import { adminErrorMessage } from "@/lib/admin/errors";
import { categoryInputSchema, couponInputSchema, firstIssues, productInputSchema, settingsInputSchema } from "@/lib/admin/schemas";
import { MAX_RECEIPT_BYTES, sniffImage } from "@/lib/payments/evidence";
import { createClient } from "@/lib/supabase/server";
import { CATALOG_TAG } from "@/lib/supabase/public";

export interface CatalogResult {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
  id?: string;
}

const IMAGE_BUCKET = "product-images";
const MAX_IMAGES = 8;
const uuid = z.string().uuid();

/** Catalogue changes show in the shop at once (read-your-own-writes). */
function refreshCatalog() {
  updateTag(CATALOG_TAG);
  revalidatePath("/admin", "layout");
}

async function guard(): Promise<CatalogResult | null> {
  const denied = await adminActionError();
  return denied ? { ok: false, message: denied } : null;
}

const SAVE_ERRORS: Record<string, { field?: string; message: string }> = {
  duplicate_slug: { field: "slug", message: "Another product already uses this web address (slug)." },
  duplicate_sku: { field: "variants", message: "One of the SKUs is already used by another product." },
  duplicate_variant: { field: "variants", message: "This product already has that size + colour." },
  variants_required: { field: "variants", message: "Add at least one size / colour." },
  invalid_product: { message: "Some values are not valid. Please check the form." },
  product_not_found: { message: "Product not found." },
  variant_not_found: { message: "A variant was not found. Refresh the page and try again." },
};

export async function saveProduct(productId: string | null, input: unknown): Promise<CatalogResult> {
  const denied = await guard();
  if (denied) return denied;
  if (productId !== null && !uuid.safeParse(productId).success) return { ok: false, message: "Invalid product." };
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please correct the highlighted fields.", errors: firstIssues(parsed.error) };
  const p = parsed.data;

  const { data, error } = await (await createClient()).rpc("admin_save_product", {
    p_product_id: productId,
    p: {
      name: p.name,
      slug: p.slug,
      category_id: p.categoryId ?? "",
      audience: p.audience,
      description: p.description,
      details: p.details,
      base_price: p.basePrice,
      compare_at_price: p.compareAtPrice ?? "",
      is_active: p.isActive,
      is_featured: p.isFeatured,
      is_new_arrival: p.isNewArrival,
      variants: p.variants.map((v) => ({
        id: v.id ?? "",
        size: v.size,
        color: v.color,
        color_hex: v.colorHex,
        sku: v.sku,
        price_override: v.priceOverride ?? "",
        stock: v.stock,
        is_active: v.isActive,
      })),
    },
  });
  if (error) {
    const known = SAVE_ERRORS[error.message];
    if (!known) console.error("[admin] save product failed", error.code, error.message);
    return {
      ok: false,
      message: known?.message ?? adminErrorMessage(error.message),
      errors: known?.field ? { [known.field]: known.message } : undefined,
    };
  }
  refreshCatalog();
  return { ok: true, message: productId ? "Product saved." : "Product created. Now add photos.", id: String(data) };
}

export async function setProductActive(productId: string, active: boolean): Promise<CatalogResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(productId).success) return { ok: false, message: "Invalid product." };
  const { error } = await (await createClient()).from("products").update({ is_active: active }).eq("id", productId);
  if (error) return { ok: false, message: "Could not update the product." };
  refreshCatalog();
  return { ok: true, message: active ? "Product is live in the shop again." : "Product archived — hidden from the shop." };
}

/** Only for products that were never ordered (orders keep their links otherwise). */
export async function deleteProduct(productId: string): Promise<CatalogResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(productId).success) return { ok: false, message: "Invalid product." };
  const supabase = await createClient();
  const { data: images } = await supabase.from("product_images").select("url").eq("product_id", productId);
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) {
    return {
      ok: false,
      message: error.message.includes("product_has_orders") ? "This product has orders, so it can only be archived." : "Could not delete the product.",
    };
  }
  const paths = (images ?? []).map((i) => storagePath(i.url)).filter((p): p is string => Boolean(p));
  if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  refreshCatalog();
  return { ok: true, message: "Product deleted." };
}

/** "…/storage/v1/object/public/product-images/<path>" → "<path>" for our own uploads. */
function storagePath(url: string): string | null {
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}

export async function uploadProductImages(productId: string, form: FormData): Promise<CatalogResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(productId).success) return { ok: false, message: "Invalid product." };
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, message: "Choose one or more photos." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("product_images").select("sort_order").eq("product_id", productId);
  if ((existing?.length ?? 0) + files.length > MAX_IMAGES) return { ok: false, message: `A product can have up to ${MAX_IMAGES} photos.` };
  const { data: product } = await supabase.from("products").select("name").eq("id", productId).maybeSingle();
  if (!product) return { ok: false, message: "Product not found." };

  let next = Math.max(-1, ...(existing ?? []).map((i) => i.sort_order)) + 1;
  for (const file of files) {
    if (file.size > MAX_RECEIPT_BYTES) return { ok: false, message: `${file.name} is larger than 5 MB.` };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return { ok: false, message: `${file.name} is not a JPG, PNG or WebP image.` };
    const path = `products/${productId}/${Date.now()}-${randomBytes(5).toString("hex")}.${kind.ext}`;
    const up = await supabase.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: kind.contentType, upsert: false, cacheControl: "31536000" });
    if (up.error) {
      console.error("[admin] image upload failed", up.error.message);
      return { ok: false, message: "Upload failed. Please try again." };
    }
    const url = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("product_images").insert({ product_id: productId, url, alt: product.name, sort_order: next++ });
    if (error) {
      await supabase.storage.from(IMAGE_BUCKET).remove([path]);
      return { ok: false, message: "Could not save the photo." };
    }
  }
  refreshCatalog();
  return { ok: true, message: files.length === 1 ? "Photo added." : `${files.length} photos added.` };
}

export async function updateProductImage(imageId: string, input: { alt?: string; move?: "up" | "down" }): Promise<CatalogResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(imageId).success) return { ok: false, message: "Invalid photo." };
  const supabase = await createClient();
  const { data: image } = await supabase.from("product_images").select("id, product_id, sort_order").eq("id", imageId).maybeSingle();
  if (!image) return { ok: false, message: "Photo not found." };
  if (input.alt !== undefined) {
    const alt = input.alt.trim().slice(0, 200);
    await supabase.from("product_images").update({ alt }).eq("id", imageId);
  }
  if (input.move) {
    const { data: all } = await supabase.from("product_images").select("id, sort_order").eq("product_id", image.product_id).order("sort_order");
    const list = all ?? [];
    const i = list.findIndex((x) => x.id === imageId);
    const j = input.move === "up" ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < list.length) {
      [list[i], list[j]] = [list[j], list[i]];
      for (const [k, row] of list.entries()) await supabase.from("product_images").update({ sort_order: k }).eq("id", row.id);
    }
  }
  refreshCatalog();
  return { ok: true, message: input.move ? "Photo order updated." : "Description saved." };
}

export async function deleteProductImage(imageId: string): Promise<CatalogResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(imageId).success) return { ok: false, message: "Invalid photo." };
  const supabase = await createClient();
  const { data: image } = await supabase.from("product_images").delete().eq("id", imageId).select("url").maybeSingle();
  if (!image) return { ok: false, message: "Photo not found." };
  const path = storagePath(image.url);
  if (path) await supabase.storage.from(IMAGE_BUCKET).remove([path]);
  refreshCatalog();
  return { ok: true, message: "Photo removed." };
}

export async function saveCategory(input: unknown): Promise<CatalogResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please correct the highlighted fields.", errors: firstIssues(parsed.error) };
  const c = parsed.data;
  const row = { name: c.name, slug: c.slug, description: c.description || null, sort_order: c.sortOrder, is_active: c.isActive };
  const supabase = await createClient();
  const { error } = c.id ? await supabase.from("categories").update(row).eq("id", c.id) : await supabase.from("categories").insert(row);
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Another category already uses this slug.", errors: { slug: "Already in use." } };
    return { ok: false, message: "Could not save the category." };
  }
  refreshCatalog();
  return { ok: true, message: c.id ? "Category saved." : "Category created." };
}

export async function deleteCategory(categoryId: string): Promise<CatalogResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(categoryId).success) return { ok: false, message: "Invalid category." };
  const supabase = await createClient();
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", categoryId);
  if ((count ?? 0) > 0) return { ok: false, message: "Move or archive this category's products first, or hide the category instead." };
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) return { ok: false, message: "Could not delete the category." };
  refreshCatalog();
  return { ok: true, message: "Category deleted." };
}

export async function uploadCategoryImage(categoryId: string, form: FormData): Promise<CatalogResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(categoryId).success) return { ok: false, message: "Invalid category." };
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo." };
  if (file.size > MAX_RECEIPT_BYTES) return { ok: false, message: "The photo must be 5 MB or smaller." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { ok: false, message: "Upload a JPG, PNG or WebP image." };
  const supabase = await createClient();
  const path = `categories/${categoryId}/${Date.now()}-${randomBytes(5).toString("hex")}.${kind.ext}`;
  const up = await supabase.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: kind.contentType, upsert: false, cacheControl: "31536000" });
  if (up.error) return { ok: false, message: "Upload failed. Please try again." };
  const url = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  const { data: old } = await supabase.from("categories").select("image_url").eq("id", categoryId).maybeSingle();
  const { error } = await supabase.from("categories").update({ image_url: url }).eq("id", categoryId);
  if (error) {
    await supabase.storage.from(IMAGE_BUCKET).remove([path]);
    return { ok: false, message: "Could not save the photo." };
  }
  const oldPath = old?.image_url ? storagePath(old.image_url) : null;
  if (oldPath) await supabase.storage.from(IMAGE_BUCKET).remove([oldPath]);
  refreshCatalog();
  return { ok: true, message: "Category photo updated." };
}

const stockSchema = z.object({
  variantId: z.string().uuid(),
  change: z.coerce.number().int("Whole numbers only.").refine((n) => n !== 0, "Enter a number that is not zero.").refine((n) => Math.abs(n) <= 100000, "That number is too large."),
  note: z.string().trim().max(300).optional().default(""),
});

/** Audited stock change (inventory_movements via adjust_stock). */
export async function adjustStock(input: z.input<typeof stockSchema>): Promise<CatalogResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = stockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };
  const { data, error } = await (await createClient()).rpc("adjust_stock", {
    p_variant_id: parsed.data.variantId,
    p_change: parsed.data.change,
    p_note: parsed.data.note || null,
  });
  if (error) return { ok: false, message: adminErrorMessage(error.message) };
  refreshCatalog();
  return { ok: true, message: `Stock updated — now ${Number(data)}.` };
}

export async function saveCoupon(input: unknown): Promise<CatalogResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = couponInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please correct the highlighted fields.", errors: firstIssues(parsed.error) };
  const c = parsed.data;
  const row = {
    code: c.code,
    description: c.description || null,
    discount_type: c.discountType,
    discount_value: c.discountValue,
    min_order_amount: c.minOrderAmount,
    max_uses: c.maxUses,
    valid_from: c.validFrom ? new Date(`${c.validFrom}T00:00:00+05:00`).toISOString() : null,
    valid_until: c.validUntil ? new Date(`${c.validUntil}T23:59:59+05:00`).toISOString() : null,
    is_active: c.isActive,
  };
  const supabase = await createClient();
  const { error } = c.id ? await supabase.from("coupons").update(row).eq("id", c.id) : await supabase.from("coupons").insert(row);
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That code already exists.", errors: { code: "Already exists." } };
    return { ok: false, message: "Could not save the coupon." };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: c.id ? "Coupon saved." : "Coupon created." };
}

export async function saveSettings(input: unknown): Promise<CatalogResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please correct the highlighted fields.", errors: firstIssues(parsed.error) };
  const s = parsed.data;
  const { error } = await (await createClient())
    .from("store_settings")
    .update({
      store_name: s.storeName,
      support_phone: s.supportPhone,
      support_email: s.supportEmail,
      whatsapp_number: s.whatsapp,
      store_address: s.storeAddress,
      delivery_charge: s.deliveryCharge,
      free_delivery_min: s.freeDeliveryMin,
      low_stock_threshold: s.lowStockThreshold,
      easypaisa_account_name: s.easypaisaName,
      easypaisa_account_number: s.easypaisaNumber,
      jazzcash_account_name: s.jazzcashName,
      jazzcash_account_number: s.jazzcashNumber,
    })
    .eq("id", 1);
  if (error) {
    console.error("[admin] settings save failed", error.code);
    return { ok: false, message: "Could not save settings." };
  }
  refreshCatalog();
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved. The shop shows the new details now." };
}
