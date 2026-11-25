/**
 * Shared admin shapes (Step 5).
 *
 * The admin UI works with these shapes in BOTH modes: live mode maps
 * Supabase rows to them in the /api/admin/* routes; demo mode maps the
 * local seed data + demo orders to them in src/lib/admin-data.ts.
 * `demo: true` means the row lives only in this browser, not in Supabase.
 */
import type { OrderStatus, PaymentMethod, PaymentStatus } from "./types";

export interface AdminOrderItem {
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  image: string;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  province: string | null;
  postalCode: string | null;
  subtotal: number;
  deliveryCharges: number;
  discountAmount: number;
  couponCode: string | null;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  notes: string | null;
  createdAt: string;
  items: AdminOrderItem[];
  transactionId: string | null;
  receiptUrl: string | null;
  receiptFileName: string | null;
  paymentReviewNote: string | null;
  paymentReviewedAt: string | null;
  demo: boolean;
}

export interface AdminPayment {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  paymentMethod: PaymentMethod;
  transactionId: string | null;
  amount: number;
  receiptUrl: string | null;
  receiptFileName: string | null;
  status: PaymentStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  demo: boolean;
}

export interface AdminProductVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  priceOverride: number | null;
}

export interface AdminProduct {
  id: string;
  categoryId: string | null;
  categorySlug: string;
  categoryName: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  images: string[];
  isFeatured: boolean;
  isNew: boolean;
  isActive: boolean;
  variants: AdminProductVariant[];
  demo: boolean;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  demo: boolean;
}

export interface AdminCustomer {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: "customer" | "admin";
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  createdAt: string;
  demo: boolean;
}

export interface AdminOverview {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  pendingOrders: number;
  pendingPayments: number;
  lowStockCount: number;
  todayOrders: number;
  todayRevenue: number;
  recentOrders: AdminOrder[];
  lowStockVariants: Array<{
    productName: string;
    sku: string;
    size: string;
    color: string;
    stock: number;
  }>;
}

export interface AdminReport {
  range: string;
  orderCount: number;
  revenue: number;
  pendingOrders: number;
  averageOrderValue: number;
  daily: Array<{ date: string; orders: number; revenue: number }>;
  monthly: Array<{ month: string; orders: number; revenue: number }>;
  bestSellers: Array<{
    productName: string;
    sku: string | null;
    quantity: number;
    revenue: number;
  }>;
}
