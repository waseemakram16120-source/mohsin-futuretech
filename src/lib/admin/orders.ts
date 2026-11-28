import "server-only";

import { z } from "zod";
import { ALL_PAYMENT_METHODS } from "@/config/store";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

const money = z.union([z.number(), z.string()]).transform(Number);

export const ADMIN_PAGE_SIZE = 20;

export const orderFiltersSchema = z.object({
  q: z.string().trim().max(60).optional().catch(undefined),
  status: z.enum(ORDER_STATUSES).optional().catch(undefined),
  payment: z.enum(PAYMENT_STATUSES).optional().catch(undefined),
  method: z.enum(ALL_PAYMENT_METHODS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});
export type OrderFilters = z.infer<typeof orderFiltersSchema>;

const rowSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  created_at: z.string(),
  delivery_name: z.string(),
  delivery_phone: z.string(),
  city: z.string(),
  status: z.enum(ORDER_STATUSES),
  payment_status: z.enum(PAYMENT_STATUSES),
  payment_method: z.enum(ALL_PAYMENT_METHODS),
  total_amount: money,
});
export type AdminOrderRow = z.infer<typeof rowSchema>;

const ROW_SELECT = "id, order_number, created_at, delivery_name, delivery_phone, city, status, payment_status, payment_method, total_amount";

/** Characters that would change the meaning of a PostgREST or() filter. */
function cleanSearch(q: string) {
  return q.replace(/[,()*%\\]/g, " ").trim();
}

export async function listOrders(filters: OrderFilters) {
  const page = filters.page ?? 1;
  let query = (await createClient()).from("orders").select(ROW_SELECT, { count: "exact" });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.payment) query = query.eq("payment_status", filters.payment);
  if (filters.method) query = query.eq("payment_method", filters.method);
  const q = filters.q ? cleanSearch(filters.q) : "";
  if (q) {
    const digits = q.replace(/\D/g, "");
    const parts = [`order_number.ilike.*${q.toUpperCase()}*`, `delivery_name.ilike.*${q}*`];
    if (digits.length >= 4) parts.push(`delivery_phone.ilike.*${digits.replace(/^92/, "0")}*`);
    query = query.or(parts.join(","));
  }
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) throw new Error("Could not load orders", { cause: error });
  return { rows: z.array(rowSchema).parse(data ?? []), total: count ?? 0, page, pageSize: ADMIN_PAGE_SIZE };
}

export async function recentOrders(limit = 8) {
  const { data, error } = await (await createClient())
    .from("orders")
    .select(ROW_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load orders", { cause: error });
  return z.array(rowSchema).parse(data ?? []);
}

const overviewSchema = z.object({
  orders_total: z.number(),
  orders_today: z.number(),
  orders_pending: z.number(),
  orders_to_ship: z.number(),
  sales_total: money,
  sales_today: money,
  revenue_collected: money,
  payments_to_verify: z.number(),
  cod_to_collect: z.number(),
  customers: z.number(),
  products_active: z.number(),
  low_stock: z.number(),
  out_of_stock: z.number(),
  low_stock_threshold: z.number(),
});
export type AdminOverview = z.infer<typeof overviewSchema>;

export async function adminOverview(): Promise<AdminOverview> {
  const { data, error } = await (await createClient()).rpc("admin_overview");
  if (error) throw new Error("Could not load dashboard", { cause: error });
  return overviewSchema.parse(data);
}

const detailSchema = rowSchema.extend({
  user_id: z.string().uuid().nullable(),
  customer_email: z.string().nullable(),
  delivery_address: z.string(),
  province: z.string().nullable(),
  postal_code: z.string().nullable(),
  notes: z.string().nullable(),
  subtotal: money,
  discount_amount: money,
  delivery_charge: money,
  coupon_code: z.string().nullable(),
  order_items: z.array(
    z.object({
      id: z.string().uuid(),
      product_name: z.string(),
      product_slug: z.string().nullable(),
      sku: z.string(),
      size: z.string(),
      color: z.string(),
      image_url: z.string().nullable(),
      unit_price: money,
      quantity: z.number(),
      line_total: money,
    }),
  ),
  order_status_history: z.array(
    z.object({
      from_status: z.enum(ORDER_STATUSES).nullable(),
      to_status: z.enum(ORDER_STATUSES),
      note: z.string().nullable(),
      created_at: z.string(),
      changed_by_profile: z.object({ full_name: z.string(), email: z.string() }).nullable(),
    }),
  ),
  payments: z.array(
    z.object({
      id: z.string().uuid(),
      seq: z.number(),
      method: z.enum(ALL_PAYMENT_METHODS),
      amount: money,
      status: z.enum(PAYMENT_STATUSES),
      transaction_id: z.string().nullable(),
      receipt_path: z.string().nullable(),
      customer_note: z.string().nullable(),
      review_note: z.string().nullable(),
      submitted_at: z.string().nullable(),
      reviewed_at: z.string().nullable(),
      created_at: z.string(),
      reviewer: z.object({ full_name: z.string(), email: z.string() }).nullable(),
    }),
  ),
});
type DetailRow = z.infer<typeof detailSchema>;
export type AdminPaymentRecord = DetailRow["payments"][number] & { receiptUrl: string | null };
export type AdminOrderDetail = Omit<DetailRow, "payments"> & { payments: AdminPaymentRecord[] };

const RECEIPT_URL_SECONDS = 60 * 60;

export async function getAdminOrder(orderNumber: string): Promise<AdminOrderDetail | null> {
  if (!/^MF-\d{6}-\d{5,}$/.test(orderNumber)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `${ROW_SELECT}, user_id, customer_email, delivery_address, province, postal_code, notes, subtotal, discount_amount, delivery_charge, coupon_code,
       order_items(id, product_name, product_slug, sku, size, color, image_url, unit_price, quantity, line_total),
       order_status_history(from_status, to_status, note, created_at, changed_by_profile:profiles!order_status_history_changed_by_fkey(full_name, email)),
       payments(id, seq, method, amount, status, transaction_id, receipt_path, customer_note, review_note, submitted_at, reviewed_at, created_at, reviewer:profiles!payments_reviewed_by_fkey(full_name, email))`,
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error) throw new Error("Could not load order", { cause: error });
  if (!data) return null;
  const order = detailSchema.parse(data);
  order.order_status_history.sort((a, b) => a.created_at.localeCompare(b.created_at));
  order.payments.sort((a, b) => a.seq - b.seq);

  // Receipts live in a PRIVATE bucket: short-lived signed links, admin only (storage policy).
  const paths = order.payments.map((p) => p.receipt_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("payment-receipts").createSignedUrls(paths, RECEIPT_URL_SECONDS);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return {
    ...order,
    payments: order.payments.map((p) => ({ ...p, receiptUrl: p.receipt_path ? (urls.get(p.receipt_path) ?? null) : null })),
  };
}

const queueSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(PAYMENT_STATUSES),
  method: z.enum(ALL_PAYMENT_METHODS),
  amount: money,
  transaction_id: z.string().nullable(),
  receipt_path: z.string().nullable(),
  customer_note: z.string().nullable(),
  submitted_at: z.string().nullable(),
  order: z.object({
    order_number: z.string(),
    delivery_name: z.string(),
    delivery_phone: z.string(),
    total_amount: money,
    status: z.enum(ORDER_STATUSES),
    payment_status: z.enum(PAYMENT_STATUSES),
  }),
});
export type PaymentQueueItem = z.infer<typeof queueSchema> & { receiptUrl: string | null };

/** Wallet payments waiting for review (oldest first, so nobody waits too long). */
export async function paymentsToVerify(): Promise<PaymentQueueItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, status, method, amount, transaction_id, receipt_path, customer_note, submitted_at, order:orders!inner(order_number, delivery_name, delivery_phone, total_amount, status, payment_status)",
    )
    .eq("status", "pending_verification")
    .order("submitted_at", { ascending: true })
    .limit(100);
  if (error) throw new Error("Could not load payments", { cause: error });
  const rows = z.array(queueSchema).parse(data ?? []);
  const paths = rows.map((r) => r.receipt_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("payment-receipts").createSignedUrls(paths, RECEIPT_URL_SECONDS);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({ ...r, receiptUrl: r.receipt_path ? (urls.get(r.receipt_path) ?? null) : null }));
}

const codSchema = z.object({
  id: z.string().uuid(),
  amount: money,
  order: z.object({ order_number: z.string(), delivery_name: z.string(), city: z.string(), status: z.enum(ORDER_STATUSES), created_at: z.string() }),
});
export type CodItem = z.infer<typeof codSchema>;

/** COD orders delivered but not yet marked as paid. */
export async function codToCollect(): Promise<CodItem[]> {
  const { data, error } = await (await createClient())
    .from("payments")
    .select("id, amount, order:orders!inner(order_number, delivery_name, city, status, created_at, payment_status)")
    .eq("status", "due")
    .eq("order.status", "delivered")
    .eq("order.payment_status", "due")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error("Could not load COD payments", { cause: error });
  return z.array(codSchema).parse(data ?? []);
}
