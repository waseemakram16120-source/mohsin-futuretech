/**
 * Domain constants shared by the app and mirrored by the database enums in
 * supabase/migrations. tests/db/enums.test.ts fails if the two drift apart.
 */

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

/**
 * Allowed order status changes (proposal §7). The database function
 * public.update_order_status enforces the same table.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export const PAYMENT_STATUSES = [
  "awaiting_payment",
  "pending_verification",
  "approved",
  "rejected",
  "due",
  "paid",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Customer-facing labels (proposal §6 table). */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  awaiting_payment: "Awaiting Payment",
  pending_verification: "Pending Verification",
  approved: "Approved",
  rejected: "Rejected",
  due: "COD — Due",
  paid: "Paid",
};

export const AUDIENCES = ["men", "women", "unisex"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const DISCOUNT_TYPES = ["percentage", "fixed"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const STOCK_REASONS = [
  "initial",
  "order",
  "cancel",
  "return",
  "adjustment",
] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export const USER_ROLES = ["customer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];
