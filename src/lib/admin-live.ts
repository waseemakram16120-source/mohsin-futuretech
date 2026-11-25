/**
 * Live-mode admin data mapping (Step 5, server-only).
 *
 * Maps Supabase rows (orders / order_items / payments / profiles /
 * products / product_variants / categories) to the shared Admin* shapes
 * in src/lib/admin-types.ts, so the admin UI is identical in live and
 * demo mode.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminCustomer,
  AdminOrder,
  AdminOverview,
  AdminPayment,
  AdminReport,
} from "./admin-types";
import { signedReceiptUrl } from "./admin-auth";

type Row = Record<string, unknown>;

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function fetchLiveOrders(
  admin: SupabaseClient,
): Promise<AdminOrder[]> {
  const [{ data: orders }, { data: items }, { data: payments }] =
    await Promise.all([
      admin.from("orders").select("*").order("created_at", { ascending: false }),
      admin.from("order_items").select("*"),
      admin.from("payments").select("*"),
    ]);
  const itemsByOrder = new Map<string, Row[]>();
  for (const item of (items ?? []) as Row[]) {
    const list = itemsByOrder.get(str(item.order_id)) ?? [];
    list.push(item);
    itemsByOrder.set(str(item.order_id), list);
  }
  const paymentByOrder = new Map<string, Row>();
  for (const p of (payments ?? []) as Row[]) {
    paymentByOrder.set(str(p.order_id), p);
  }
  const result: AdminOrder[] = [];
  for (const o of (orders ?? []) as Row[]) {
    const payment = paymentByOrder.get(str(o.id));
    result.push({
      id: str(o.id),
      orderNumber: str(o.order_number),
      userId: (o.user_id as string | null) ?? null,
      customerName: str(o.delivery_name),
      phone: str(o.delivery_phone),
      address: str(o.delivery_address),
      city: str(o.city),
      province: (o.province as string | null) ?? null,
      postalCode: (o.postal_code as string | null) ?? null,
      subtotal: num(o.subtotal),
      deliveryCharges: num(o.delivery_charges),
      discountAmount: num(o.discount_amount),
      couponCode: (o.coupon_code as string | null) ?? null,
      totalAmount: num(o.total_amount),
      paymentMethod: o.payment_method as AdminOrder["paymentMethod"],
      paymentStatus: payment
        ? (payment.status as AdminOrder["paymentStatus"])
        : o.payment_method === "cod"
          ? "due"
          : "pending_verification",
      status: o.status as AdminOrder["status"],
      notes: (o.notes as string | null) ?? null,
      createdAt: str(o.created_at),
      items: (itemsByOrder.get(str(o.id)) ?? []).map((i) => ({
        productName: str(i.product_name),
        variantLabel: (i.variant_label as string | null) ?? null,
        sku: (i.sku as string | null) ?? null,
        unitPrice: num(i.unit_price),
        quantity: num(i.quantity),
        lineTotal: num(i.line_total),
        image: "",
      })),
      transactionId: payment ? ((payment.transaction_id as string | null) ?? null) : null,
      receiptUrl: payment
        ? await signedReceiptUrl(admin, (payment.receipt_url as string | null) ?? null)
        : null,
      receiptFileName: payment?.receipt_url
        ? String(payment.receipt_url).split("/").pop() ?? null
        : null,
      paymentReviewNote: payment ? ((payment.review_note as string | null) ?? null) : null,
      paymentReviewedAt: payment ? ((payment.reviewed_at as string | null) ?? null) : null,
      demo: false,
    });
  }
  return result;
}

export async function fetchLivePayments(
  admin: SupabaseClient,
): Promise<AdminPayment[]> {
  const orders = await fetchLiveOrders(admin);
  const byNumber = new Map(orders.map((o) => [o.orderNumber, o]));
  const { data: payments } = await admin
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false });
  const out: AdminPayment[] = [];
  for (const p of (payments ?? []) as Row[]) {
    const order = orders.find((o) => o.id === str(p.order_id));
    if (!order) continue;
    out.push({
      id: str(p.id),
      orderId: str(p.order_id),
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      phone: order.phone,
      paymentMethod: p.payment_method as AdminPayment["paymentMethod"],
      transactionId: (p.transaction_id as string | null) ?? null,
      amount: num(p.amount),
      receiptUrl: await signedReceiptUrl(
        admin,
        (p.receipt_url as string | null) ?? null,
      ),
      receiptFileName: p.receipt_url
        ? String(p.receipt_url).split("/").pop() ?? null
        : null,
      status: p.status as AdminPayment["status"],
      reviewNote: (p.review_note as string | null) ?? null,
      reviewedAt: (p.reviewed_at as string | null) ?? null,
      createdAt: str(p.created_at),
      demo: false,
    });
  }
  void byNumber;
  return out;
}

export async function fetchLiveCustomers(
  admin: SupabaseClient,
): Promise<AdminCustomer[]> {
  const [{ data: profiles }, { data: orders }] = await Promise.all([
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("orders").select("user_id, delivery_phone, total_amount, created_at, status"),
  ]);
  const agg = new Map<string, { count: number; spent: number; last: string | null }>();
  for (const o of (orders ?? []) as Row[]) {
    const key = str(o.user_id) || `phone:${str(o.delivery_phone)}`;
    const row = agg.get(key) ?? { count: 0, spent: 0, last: null };
    row.count += 1;
    if (o.status !== "cancelled" && o.status !== "returned") {
      row.spent += num(o.total_amount);
    }
    if (!row.last || str(o.created_at) > row.last) row.last = str(o.created_at);
    agg.set(key, row);
  }
  return ((profiles ?? []) as Row[]).map((p) => {
    const row = agg.get(str(p.id)) ?? { count: 0, spent: 0, last: null };
    return {
      id: str(p.id),
      email: str(p.email),
      fullName: str(p.full_name) || str(p.email),
      phone: (p.phone as string | null) ?? null,
      role: (p.role as "customer" | "admin") ?? "customer",
      orderCount: row.count,
      totalSpent: row.spent,
      lastOrderAt: row.last,
      createdAt: str(p.created_at),
      demo: false,
    };
  });
}

export async function fetchLiveOverview(
  admin: SupabaseClient,
): Promise<AdminOverview> {
  const orders = await fetchLiveOrders(admin);
  const [{ data: products }, { data: variants }] = await Promise.all([
    admin.from("products").select("id"),
    admin.from("product_variants").select("sku, size, color, stock_quantity, product_id"),
  ]);
  const [{ data: profiles }] = await Promise.all([
    admin.from("profiles").select("id"),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.createdAt.slice(0, 10) === today);
  const productNames = new Map<string, string>();
  const { data: productRows } = await admin.from("products").select("id, name");
  for (const p of (productRows ?? []) as Row[]) {
    productNames.set(str(p.id), str(p.name));
  }
  const lowStock = ((variants ?? []) as Row[])
    .filter((v) => num(v.stock_quantity) <= 5)
    .map((v) => ({
      productName: productNames.get(str(v.product_id)) ?? "Product",
      sku: str(v.sku),
      size: str(v.size),
      color: str(v.color),
      stock: num(v.stock_quantity),
    }))
    .sort((a, b) => a.stock - b.stock);
  const active = orders.filter(
    (o) => o.status !== "cancelled" && o.status !== "returned",
  );
  return {
    totalOrders: orders.length,
    totalRevenue: active.reduce((s, o) => s + o.totalAmount, 0),
    totalCustomers: (profiles ?? []).length,
    totalProducts: (products ?? []).length,
    pendingOrders: orders.filter((o) => o.status === "pending").length,
    pendingPayments: orders.filter(
      (o) => o.paymentStatus === "pending_verification",
    ).length,
    lowStockCount: lowStock.length,
    todayOrders: todayOrders.length,
    todayRevenue: todayOrders.reduce((s, o) => s + o.totalAmount, 0),
    recentOrders: orders.slice(0, 8),
    lowStockVariants: lowStock.slice(0, 10),
  };
}

export async function fetchLiveReport(
  admin: SupabaseClient,
  range: string,
): Promise<AdminReport> {
  const orders = (await fetchLiveOrders(admin)).filter(
    (o) => o.status !== "cancelled" && o.status !== "returned",
  );
  const now = new Date();
  const inRange = orders.filter((o) => {
    if (range === "all") return true;
    const d = new Date(o.createdAt);
    if (range === "today") return d.toDateString() === now.toDateString();
    const days = range === "7d" ? 7 : 30;
    return now.getTime() - d.getTime() <= days * 24 * 60 * 60 * 1000;
  });
  const revenue = inRange.reduce((s, o) => s + o.totalAmount, 0);
  const dailyMap = new Map<string, { orders: number; revenue: number }>();
  const monthlyMap = new Map<string, { orders: number; revenue: number }>();
  const sellerMap = new Map<
    string,
    { productName: string; sku: string | null; quantity: number; revenue: number }
  >();
  for (const o of inRange) {
    const day = o.createdAt.slice(0, 10);
    const dRow = dailyMap.get(day) ?? { orders: 0, revenue: 0 };
    dRow.orders += 1;
    dRow.revenue += o.totalAmount;
    dailyMap.set(day, dRow);
    const month = o.createdAt.slice(0, 7);
    const mRow = monthlyMap.get(month) ?? { orders: 0, revenue: 0 };
    mRow.orders += 1;
    mRow.revenue += o.totalAmount;
    monthlyMap.set(month, mRow);
    for (const item of o.items) {
      const key = item.sku ?? item.productName;
      const row = sellerMap.get(key) ?? {
        productName: item.productName,
        sku: item.sku,
        quantity: 0,
        revenue: 0,
      };
      row.quantity += item.quantity;
      row.revenue += item.lineTotal;
      sellerMap.set(key, row);
    }
  }
  const allOrders = await fetchLiveOrders(admin);
  return {
    range,
    orderCount: inRange.length,
    revenue,
    pendingOrders: allOrders.filter((o) => o.status === "pending").length,
    averageOrderValue:
      inRange.length > 0 ? Math.round(revenue / inRange.length) : 0,
    daily: [...dailyMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, v]) => ({ date, ...v })),
    monthly: [...monthlyMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, v]) => ({ month, ...v })),
    bestSellers: [...sellerMap.values()].sort((a, b) => b.quantity - a.quantity),
  };
}
