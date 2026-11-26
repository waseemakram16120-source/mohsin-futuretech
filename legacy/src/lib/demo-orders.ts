/**
 * Demo-mode storage (Step 3).
 *
 * When no live Supabase project is configured, orders are NOT written to
 * any database — the API route returns the order as "demo" and the browser
 * saves it here in localStorage so order history and order tracking can
 * still show it. The same file holds the demo profile / saved addresses
 * used to pre-fill checkout when the customer is not signed in.
 *
 * Nothing here is a real order. Once the Supabase project is connected,
 * orders live in the database and these demo helpers are only a fallback
 * for orders placed while Supabase was unavailable.
 */
import type { OrderStatus, PaymentMethod, PaymentStatus } from "./types";
import type { CartItem } from "./cart";

export interface DemoOrderItem {
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  image: string;
}

export interface DemoPaymentSubmission {
  transactionId: string;
  receiptFileName: string;
  note: string | null;
  /** Demo only — the screenshot file itself is NOT stored, only its name. */
  receiptPreviewNote: string;
  submittedAt: string;
}

export interface DemoOrder {
  id: string;
  orderNumber: string;
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress: string;
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
  items: DemoOrderItem[];
  createdAt: string;
  /** Payment evidence submitted by the customer (Step 4, demo mode). */
  paymentSubmission?: DemoPaymentSubmission | null;
  /** Admin review of the payment (Step 5, demo mode). */
  paymentReviewNote?: string | null;
  paymentReviewedAt?: string | null;
  /** Always true — this order was never written to Supabase. */
  demo: true;
}

export interface DemoAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  isDefault: boolean;
}

export interface DemoProfile {
  fullName: string;
  phone: string;
}

const ORDERS_KEY = "mf-demo-orders-v1";
const ADDRESSES_KEY = "mf-demo-addresses-v1";
const PROFILE_KEY = "mf-demo-profile-v1";

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
    // Storage full / unavailable — demo data is best-effort only.
  }
}

export function saveDemoOrder(order: DemoOrder): void {
  const orders = read<DemoOrder[]>(ORDERS_KEY, []);
  orders.unshift(order);
  write(ORDERS_KEY, orders.slice(0, 50));
}

export function getDemoOrders(): DemoOrder[] {
  return read<DemoOrder[]>(ORDERS_KEY, []);
}

export function findDemoOrder(orderNumber: string): DemoOrder | null {
  const wanted = orderNumber.trim().toUpperCase();
  return (
    getDemoOrders().find(
      (o) => o.orderNumber.toUpperCase() === wanted,
    ) ?? null
  );
}

/**
 * Save a Step 4 payment submission on a demo order (Step 4).
 * Demo only: the screenshot file itself is NOT stored — only its file
 * name is kept, plus a note that the preview was shown on this device.
 * The payment stays Pending Verification until an admin reviews it.
 */
export function saveDemoPaymentSubmission(
  orderNumber: string,
  submission: Omit<DemoPaymentSubmission, "submittedAt" | "receiptPreviewNote">,
): DemoOrder | null {
  const orders = getDemoOrders();
  const index = orders.findIndex(
    (o) => o.orderNumber.toUpperCase() === orderNumber.trim().toUpperCase(),
  );
  if (index === -1) return null;
  const updated: DemoOrder = {
    ...orders[index],
    paymentStatus: "pending_verification",
    paymentSubmission: {
      ...submission,
      receiptPreviewNote:
        "Demo mode — the screenshot was shown on this device when submitted; only the file name is stored.",
      submittedAt: new Date().toISOString(),
    },
  };
  orders[index] = updated;
  write(ORDERS_KEY, orders.slice(0, 50));
  return updated;
}

/** Build a DemoOrder from the cart + checkout form (client-side only). */export function buildDemoOrder(args: {
  orderNumber: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    city: string;
    province?: string;
    postalCode?: string;
    notes?: string;
  };
  items: CartItem[];
  subtotal: number;
  deliveryCharges: number;
  discountAmount: number;
  couponCode: string | null;
  totalAmount: number;
  paymentMethod: PaymentMethod;
}): DemoOrder {
  return {
    id: `demo-${args.orderNumber}`,
    orderNumber: args.orderNumber,
    deliveryName: args.customer.name,
    deliveryPhone: args.customer.phone,
    deliveryAddress: args.customer.address,
    city: args.customer.city,
    province: args.customer.province || null,
    postalCode: args.customer.postalCode || null,
    subtotal: args.subtotal,
    deliveryCharges: args.deliveryCharges,
    discountAmount: args.discountAmount,
    couponCode: args.couponCode,
    totalAmount: args.totalAmount,
    paymentMethod: args.paymentMethod,
    paymentStatus: args.paymentMethod === "cod" ? "due" : "pending_verification",
    status: "pending",
    notes: args.customer.notes || null,
    items: args.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      productName: item.name,
      variantLabel: `${item.size} / ${item.color}`,
      sku: item.sku,
      unitPrice: item.price,
      quantity: item.quantity,
      lineTotal: item.price * item.quantity,
      image: item.image,
    })),
    createdAt: new Date().toISOString(),
    demo: true,
  };
}

/* ------------------------- demo profile / addresses ------------------------ */

export function getDemoProfile(): DemoProfile | null {
  return read<DemoProfile | null>(PROFILE_KEY, null);
}

export function saveDemoProfile(profile: DemoProfile): void {
  write(PROFILE_KEY, profile);
}

export function getDemoAddresses(): DemoAddress[] {
  return read<DemoAddress[]>(ADDRESSES_KEY, []);
}

export function saveDemoAddresses(addresses: DemoAddress[]): void {
  write(ADDRESSES_KEY, addresses);
}

/* ------------------------- admin mutations (Step 5, demo) ----------------- */

/** Change a demo order's status (Pending → Confirmed → … → Delivered). */
export function updateDemoOrderStatus(
  orderNumber: string,
  status: OrderStatus,
): DemoOrder | null {
  const orders = getDemoOrders();
  const index = orders.findIndex(
    (o) => o.orderNumber.toUpperCase() === orderNumber.trim().toUpperCase(),
  );
  if (index === -1) return null;
  orders[index] = { ...orders[index], status };
  write(ORDERS_KEY, orders.slice(0, 50));
  return orders[index];
}

/**
 * Admin review of a demo payment (Step 5).
 * Approve → payment Approved; Reject → payment Rejected (order stays on
 * hold, customer may resubmit — see Step 4 rules). Mark Paid → COD
 * payment recorded as Paid after delivery.
 */
export function updateDemoPaymentReview(
  orderNumber: string,
  review: { status: PaymentStatus; note: string | null },
): DemoOrder | null {
  const orders = getDemoOrders();
  const index = orders.findIndex(
    (o) => o.orderNumber.toUpperCase() === orderNumber.trim().toUpperCase(),
  );
  if (index === -1) return null;
  const updated: DemoOrder = {
    ...orders[index],
    paymentStatus: review.status,
    paymentReviewNote: review.note,
    paymentReviewedAt: new Date().toISOString(),
  };
  // Approving a pending order lets it proceed — confirm it, per PDF §6.
  if (review.status === "approved" && updated.status === "pending") {
    updated.status = "confirmed";
  }
  orders[index] = updated;
  write(ORDERS_KEY, orders.slice(0, 50));
  return updated;
}
