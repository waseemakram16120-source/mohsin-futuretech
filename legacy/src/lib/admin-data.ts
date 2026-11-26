/**
 * Demo-mode admin data (Step 5, client-side only).
 *
 * Until Supabase is connected, the admin dashboard works on local data:
 * demo orders from localStorage (src/lib/demo-orders.ts) and the seed
 * catalogue (src/lib/data/products.ts / categories.ts). Admin edits to
 * products, categories and stock are kept in localStorage overrides so
 * they survive a reload on this device — clearly demo-only, never
 * presented as database writes.
 */
import {
  getDemoOrders,
  updateDemoOrderStatus as updateDemoStatus,
  updateDemoPaymentReview as updateDemoPayment,
  type DemoOrder,
} from "./demo-orders";
import { COLOR_HEX, LOCAL_PRODUCTS, type StoreProduct } from "./data/products";
import { LOCAL_CATEGORIES, type StoreCategory } from "./data/categories";
import type {
  AdminCategory,
  AdminCustomer,
  AdminOrder,
  AdminOverview,
  AdminPayment,
  AdminProduct,
  AdminReport,
} from "./admin-types";
import type { OrderStatus, PaymentStatus } from "./types";

const PRODUCTS_KEY = "mf-admin-products-v1";
const CATEGORIES_KEY = "mf-admin-categories-v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort only.
  }
}

/* ------------------------------- products -------------------------------- */

export function getAdminProducts(): AdminProduct[] {
  const stored = read<StoreProduct[] | null>(PRODUCTS_KEY, null);
  const products = stored ?? LOCAL_PRODUCTS;
  return products.map((p) => ({
    id: p.id,
    categoryId: p.categoryId,
    categorySlug: p.categorySlug,
    categoryName: p.categoryName,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    images: p.images,
    isFeatured: p.isFeatured,
    isNew: p.isNew,
    isActive: true,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      colorHex: v.colorHex,
      stock: v.stock,
      priceOverride: null,
    })),
    demo: true,
  }));
}

export function saveAdminProducts(products: AdminProduct[]): void {
  const stored: StoreProduct[] = products.map((p) => ({
    id: p.id,
    categoryId: p.categoryId ?? "",
    categorySlug: p.categorySlug,
    categoryName: p.categoryName,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    images: p.images,
    isFeatured: p.isFeatured,
    isNew: p.isNew,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      colorHex: v.colorHex ?? COLOR_HEX[v.color] ?? "#6b7280",
      stock: v.stock,
    })),
  }));
  write(PRODUCTS_KEY, stored);
}

export function resetAdminProducts(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(PRODUCTS_KEY);
  }
}

/* ------------------------------ categories ------------------------------- */

export function getAdminCategories(): AdminCategory[] {
  const stored = read<StoreCategory[] | null>(CATEGORIES_KEY, null);
  const categories = stored ?? LOCAL_CATEGORIES;
  const products = getAdminProducts();
  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      sortOrder: c.sortOrder,
      isActive: true,
      productCount: products.filter((p) => p.categorySlug === c.slug).length,
      demo: true,
    }));
}

export function saveAdminCategories(categories: AdminCategory[]): void {
  const stored: StoreCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    sortOrder: c.sortOrder,
  }));
  write(CATEGORIES_KEY, stored);
}

/* -------------------------------- orders --------------------------------- */

export function demoOrderToAdmin(o: DemoOrder): AdminOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    userId: null,
    customerName: o.deliveryName,
    phone: o.deliveryPhone,
    address: o.deliveryAddress,
    city: o.city,
    province: o.province,
    postalCode: o.postalCode,
    subtotal: o.subtotal,
    deliveryCharges: o.deliveryCharges,
    discountAmount: o.discountAmount,
    couponCode: o.couponCode,
    totalAmount: o.totalAmount,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    notes: o.notes,
    createdAt: o.createdAt,
    items: o.items.map((i) => ({
      productName: i.productName,
      variantLabel: i.variantLabel,
      sku: i.sku,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
      image: i.image,
    })),
    transactionId: o.paymentSubmission?.transactionId ?? null,
    receiptUrl: null,
    receiptFileName: o.paymentSubmission?.receiptFileName ?? null,
    paymentReviewNote: o.paymentReviewNote ?? null,
    paymentReviewedAt: o.paymentReviewedAt ?? null,
    demo: true,
  };
}

export function getDemoAdminOrders(): AdminOrder[] {
  return getDemoOrders().map(demoOrderToAdmin);
}

export function getDemoAdminPayments(): AdminPayment[] {
  return getDemoOrders()
    .filter((o) => o.paymentMethod !== "cod" || o.paymentStatus === "paid")
    .map((o) => ({
      id: `pay-${o.id}`,
      orderId: o.id,
      orderNumber: o.orderNumber,
      customerName: o.deliveryName,
      phone: o.deliveryPhone,
      paymentMethod: o.paymentMethod,
      transactionId: o.paymentSubmission?.transactionId ?? null,
      amount: o.totalAmount,
      receiptUrl: null,
      receiptFileName: o.paymentSubmission?.receiptFileName ?? null,
      status: o.paymentStatus,
      reviewNote: o.paymentReviewNote ?? null,
      reviewedAt: o.paymentReviewedAt ?? null,
      createdAt: o.paymentSubmission?.submittedAt ?? o.createdAt,
      demo: true,
    }));
}

export function getDemoCodPayments(): AdminPayment[] {
  return getDemoOrders()
    .filter((o) => o.paymentMethod === "cod")
    .map((o) => ({
      id: `pay-${o.id}`,
      orderId: o.id,
      orderNumber: o.orderNumber,
      customerName: o.deliveryName,
      phone: o.deliveryPhone,
      paymentMethod: o.paymentMethod,
      transactionId: null,
      amount: o.totalAmount,
      receiptUrl: null,
      receiptFileName: null,
      status: o.paymentStatus,
      reviewNote: o.paymentReviewNote ?? null,
      reviewedAt: o.paymentReviewedAt ?? null,
      createdAt: o.createdAt,
      demo: true,
    }));
}

/** Demo order status update (writes to localStorage demo orders). */
export function adminUpdateDemoOrderStatus(
  orderNumber: string,
  status: OrderStatus,
): AdminOrder | null {
  const updated = updateDemoStatus(orderNumber, status);
  return updated ? demoOrderToAdmin(updated) : null;
}

/** Demo payment review — approve / reject / mark-paid (localStorage). */
export function adminUpdateDemoPayment(
  orderNumber: string,
  review: { status: PaymentStatus; note: string | null },
): AdminOrder | null {
  const updated = updateDemoPayment(orderNumber, review);
  return updated ? demoOrderToAdmin(updated) : null;
}

/* ------------------------------ customers -------------------------------- */

export function getDemoAdminCustomers(): AdminCustomer[] {
  const byPhone = new Map<string, AdminCustomer>();
  for (const o of getDemoOrders()) {
    const key = o.deliveryPhone;
    const existing = byPhone.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSpent += o.totalAmount;
      if (!existing.lastOrderAt || o.createdAt > existing.lastOrderAt) {
        existing.lastOrderAt = o.createdAt;
      }
    } else {
      byPhone.set(key, {
        id: `demo-customer-${key}`,
        email: "—",
        fullName: o.deliveryName,
        phone: o.deliveryPhone,
        role: "customer",
        orderCount: 1,
        totalSpent: o.totalAmount,
        lastOrderAt: o.createdAt,
        createdAt: o.createdAt,
        demo: true,
      });
    }
  }
  return [...byPhone.values()].sort((a, b) => b.totalSpent - a.totalSpent);
}

/* ------------------------------- overview -------------------------------- */

export function getDemoOverview(): AdminOverview {
  const orders = getDemoAdminOrders();
  const products = getAdminProducts();
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.createdAt.slice(0, 10) === today);
  const lowStock = products
    .flatMap((p) =>
      p.variants
        .filter((v) => v.stock <= 5)
        .map((v) => ({
          productName: p.name,
          sku: v.sku,
          size: v.size,
          color: v.color,
          stock: v.stock,
        })),
    )
    .sort((a, b) => a.stock - b.stock);
  return {
    totalOrders: orders.length,
    totalRevenue: orders
      .filter((o) => o.status !== "cancelled" && o.status !== "returned")
      .reduce((s, o) => s + o.totalAmount, 0),
    totalCustomers: getDemoAdminCustomers().length,
    totalProducts: products.length,
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

/* -------------------------------- reports -------------------------------- */

export function getDemoReport(range: string): AdminReport {
  const orders = getDemoAdminOrders().filter(
    (o) => o.status !== "cancelled" && o.status !== "returned",
  );
  const now = new Date();
  const inRange = orders.filter((o) => {
    if (range === "all") return true;
    const d = new Date(o.createdAt);
    const days = range === "today" ? 0 : range === "7d" ? 7 : 30;
    if (days === 0) return d.toDateString() === now.toDateString();
    return now.getTime() - d.getTime() <= days * 24 * 60 * 60 * 1000;
  });
  const revenue = inRange.reduce((s, o) => s + o.totalAmount, 0);
  const dailyMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of inRange) {
    const day = o.createdAt.slice(0, 10);
    const row = dailyMap.get(day) ?? { orders: 0, revenue: 0 };
    row.orders += 1;
    row.revenue += o.totalAmount;
    dailyMap.set(day, row);
  }
  const monthlyMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of inRange) {
    const month = o.createdAt.slice(0, 7);
    const row = monthlyMap.get(month) ?? { orders: 0, revenue: 0 };
    row.orders += 1;
    row.revenue += o.totalAmount;
    monthlyMap.set(month, row);
  }
  const sellerMap = new Map<
    string,
    { productName: string; sku: string | null; quantity: number; revenue: number }
  >();
  for (const o of inRange) {
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
  return {
    range,
    orderCount: inRange.length,
    revenue,
    pendingOrders: getDemoAdminOrders().filter((o) => o.status === "pending")
      .length,
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
