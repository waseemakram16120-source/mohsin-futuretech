import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Audience, DiscountType, OrderStatus, PaymentStatus } from "@/lib/domain";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export const PRODUCTS_PAGE_SIZE = 25;

function cleanSearch(q: string) {
  return q.replace(/[,()*%\\]/g, " ").trim();
}

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  compareAtPrice: number | null;
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  category: string | null;
  image: string | null;
  stock: number;
  variants: number;
  lowVariants: number;
}

export async function listProducts({ q, category, status, page = 1 }: { q?: string; category?: string; status?: "active" | "archived"; page?: number }) {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("store_settings").select("low_stock_threshold").eq("id", 1).maybeSingle();
  const threshold = settings?.low_stock_threshold ?? 5;
  let query = supabase
    .from("products")
    .select(
      "id, name, slug, base_price, compare_at_price, is_active, is_featured, is_new_arrival, category:categories(name, slug), product_images(url, sort_order), product_variants(stock_quantity, is_active)",
      { count: "exact" },
    );
  const term = q ? cleanSearch(q) : "";
  if (term) query = query.or(`name.ilike.*${term}*,slug.ilike.*${term}*`);
  if (category) query = query.eq("category_id", category);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "archived") query = query.eq("is_active", false);
  const from = (page - 1) * PRODUCTS_PAGE_SIZE;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + PRODUCTS_PAGE_SIZE - 1);
  if (error) throw new Error("Could not load products", { cause: error });
  const rows: AdminProductRow[] = (data ?? []).map((p) => {
    const active = (p.product_variants ?? []).filter((v: { is_active: boolean }) => v.is_active);
    const images = [...(p.product_images ?? [])].sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);
    const cat = Array.isArray(p.category) ? p.category[0] : p.category;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: Number(p.base_price),
      compareAtPrice: num(p.compare_at_price),
      isActive: p.is_active,
      isFeatured: p.is_featured,
      isNewArrival: p.is_new_arrival,
      category: cat?.name ?? null,
      image: images[0]?.url ?? null,
      stock: active.reduce((n: number, v: { stock_quantity: number }) => n + v.stock_quantity, 0),
      variants: active.length,
      lowVariants: active.filter((v: { stock_quantity: number }) => v.stock_quantity <= threshold).length,
    };
  });
  return { rows, total: count ?? 0, page, pageSize: PRODUCTS_PAGE_SIZE };
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const { data, error } = await (await createClient())
    .from("categories")
    .select("id, name, slug, description, image_url, sort_order, is_active, products(count)")
    .order("sort_order")
    .order("name");
  if (error) throw new Error("Could not load categories", { cause: error });
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.image_url,
    sortOrder: c.sort_order,
    isActive: c.is_active,
    productCount: Number((c.products as unknown as Array<{ count: number }>)?.[0]?.count ?? 0),
  }));
}

export interface AdminProductEdit {
  id: string;
  name: string;
  slug: string;
  categoryId: string | null;
  audience: Audience;
  description: string;
  details: string[];
  basePrice: number;
  compareAtPrice: number | null;
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  hasOrders: boolean;
  images: Array<{ id: string; url: string; alt: string; sortOrder: number }>;
  variants: Array<{
    id: string;
    size: string;
    color: string;
    colorHex: string;
    sku: string;
    priceOverride: number | null;
    stock: number;
    isActive: boolean;
  }>;
}

export async function getProductForEdit(id: string): Promise<AdminProductEdit | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, category_id, audience, description, details, base_price, compare_at_price, is_active, is_featured, is_new_arrival, product_images(id, url, alt, sort_order), product_variants(id, size, color, color_hex, sku, price_override, stock_quantity, is_active, sort_order)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load product", { cause: error });
  if (!data) return null;
  const { count } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id);
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    categoryId: data.category_id,
    audience: data.audience as Audience,
    description: data.description,
    details: data.details ?? [],
    basePrice: Number(data.base_price),
    compareAtPrice: num(data.compare_at_price),
    isActive: data.is_active,
    isFeatured: data.is_featured,
    isNewArrival: data.is_new_arrival,
    hasOrders: (count ?? 0) > 0,
    images: [...(data.product_images ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ id: i.id, url: i.url, alt: i.alt, sortOrder: i.sort_order })),
    variants: [...(data.product_variants ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        colorHex: v.color_hex,
        sku: v.sku,
        priceOverride: num(v.price_override),
        stock: v.stock_quantity,
        isActive: v.is_active,
      })),
  };
}

export interface InventoryRow {
  variantId: string;
  productId: string;
  productName: string;
  productActive: boolean;
  sku: string;
  size: string;
  color: string;
  stock: number;
  isActive: boolean;
}

export async function listInventory({ q, level }: { q?: string; level?: "low" | "out" }) {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("store_settings").select("low_stock_threshold").eq("id", 1).maybeSingle();
  const threshold = settings?.low_stock_threshold ?? 5;
  let query = supabase
    .from("product_variants")
    .select("id, sku, size, color, stock_quantity, is_active, product:products!inner(id, name, is_active)")
    .eq("is_active", true);
  if (level === "low") query = query.lte("stock_quantity", threshold);
  if (level === "out") query = query.eq("stock_quantity", 0);
  const { data, error } = await query.order("stock_quantity").order("sku").limit(1000);
  if (error) throw new Error("Could not load inventory", { cause: error });
  const rows: InventoryRow[] = (data ?? []).map((v) => {
    const p = Array.isArray(v.product) ? v.product[0] : v.product;
    return {
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      productActive: p.is_active,
      sku: v.sku,
      size: v.size,
      color: v.color,
      stock: v.stock_quantity,
      isActive: v.is_active,
    };
  });
  // SKU or product name; a few hundred variants, so filtered here.
  const term = q ? cleanSearch(q).toLowerCase() : "";
  return { rows: term ? rows.filter((r) => r.sku.toLowerCase().includes(term) || r.productName.toLowerCase().includes(term)) : rows, threshold };
}

export interface MovementRow {
  id: string;
  change: number;
  reason: string;
  note: string | null;
  createdAt: string;
  sku: string;
  productName: string;
  orderNumber: string | null;
  actor: string | null;
}

export async function recentMovements(limit = 30): Promise<MovementRow[]> {
  const { data, error } = await (await createClient())
    .from("inventory_movements")
    .select("id, change, reason, note, created_at, variant:product_variants(sku, product:products(name)), order:orders(order_number), actor:profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load stock history", { cause: error });
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  return (data ?? []).map((m) => {
    const variant = one(m.variant as unknown as { sku: string; product: { name: string } | { name: string }[] } | null);
    const actor = one(m.actor as unknown as { full_name: string; email: string } | null);
    return {
      id: m.id,
      change: m.change,
      reason: m.reason,
      note: m.note,
      createdAt: m.created_at,
      sku: variant?.sku ?? "—",
      productName: one(variant?.product ?? null)?.name ?? "—",
      orderNumber: one(m.order as unknown as { order_number: string } | null)?.order_number ?? null,
      actor: actor ? actor.full_name || actor.email : null,
    };
  });
}

export interface CustomerRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export const CUSTOMERS_PAGE_SIZE = 25;

export async function listCustomers({ q, page = 1 }: { q?: string; page?: number }) {
  const { data, error } = await (await createClient()).rpc("admin_customers", {
    p_search: q ?? null,
    p_limit: CUSTOMERS_PAGE_SIZE,
    p_offset: (page - 1) * CUSTOMERS_PAGE_SIZE,
  });
  if (error) throw new Error("Could not load customers", { cause: error });
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return {
    rows: rows.map(
      (r): CustomerRow => ({
        id: String(r.id),
        fullName: String(r.full_name ?? ""),
        email: String(r.email ?? ""),
        phone: (r.phone as string | null) ?? null,
        createdAt: String(r.created_at),
        ordersCount: Number(r.orders_count),
        totalSpent: Number(r.total_spent),
        lastOrderAt: (r.last_order_at as string | null) ?? null,
      }),
    ),
    total: rows.length ? Number(rows[0].total_count) : 0,
    page,
    pageSize: CUSTOMERS_PAGE_SIZE,
  };
}

export async function getCustomer(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load customer", { cause: error });
  if (!profile) return null;
  const [{ data: addresses }, { data: orders }] = await Promise.all([
    supabase.from("addresses").select("id, label, full_name, phone, address_line1, address_line2, city, province, is_default").eq("user_id", id).order("is_default", { ascending: false }),
    supabase
      .from("orders")
      .select("id, order_number, created_at, delivery_name, delivery_phone, city, status, payment_status, payment_method, total_amount")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return { profile, addresses: addresses ?? [], orders: (orders ?? []).map((o) => ({ ...o, total_amount: Number(o.total_amount), status: o.status as OrderStatus, payment_status: o.payment_status as PaymentStatus })) };
}

export interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  state: "active" | "off" | "scheduled" | "expired" | "used_up";
}

export async function listCoupons(): Promise<CouponRow[]> {
  const { data, error } = await (await createClient())
    .from("coupons")
    .select("id, code, description, discount_type, discount_value, min_order_amount, max_uses, used_count, valid_from, valid_until, is_active")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load coupons", { cause: error });
  const now = Date.now();
  return (data ?? []).map((c) => ({
    state: !c.is_active
      ? "off"
      : c.valid_from && Date.parse(c.valid_from) > now
        ? "scheduled"
        : c.valid_until && Date.parse(c.valid_until) < now
          ? "expired"
          : c.max_uses !== null && c.used_count >= c.max_uses
            ? "used_up"
            : "active",
    id: c.id,
    code: c.code,
    description: c.description,
    discountType: c.discount_type as DiscountType,
    discountValue: Number(c.discount_value),
    minOrderAmount: Number(c.min_order_amount),
    maxUses: c.max_uses,
    usedCount: c.used_count,
    validFrom: c.valid_from,
    validUntil: c.valid_until,
    isActive: c.is_active,
  }));
}

export interface RawSettings {
  store_name: string;
  support_phone: string | null;
  support_email: string | null;
  whatsapp_number: string | null;
  store_address: string | null;
  delivery_charge: number;
  free_delivery_min: number;
  low_stock_threshold: number;
  easypaisa_account_name: string | null;
  easypaisa_account_number: string | null;
  jazzcash_account_name: string | null;
  jazzcash_account_number: string | null;
}

/** The settings row exactly as stored (no fallbacks), for the settings form. */
export async function getRawSettings(): Promise<RawSettings> {
  const { data, error } = await (await createClient())
    .from("store_settings")
    .select("store_name, support_phone, support_email, whatsapp_number, store_address, delivery_charge, free_delivery_min, low_stock_threshold, easypaisa_account_name, easypaisa_account_number, jazzcash_account_name, jazzcash_account_number")
    .eq("id", 1)
    .single();
  if (error) throw new Error("Could not load settings", { cause: error });
  return { ...data, delivery_charge: Number(data.delivery_charge), free_delivery_min: Number(data.free_delivery_min) };
}
