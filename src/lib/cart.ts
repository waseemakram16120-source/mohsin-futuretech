/**
 * Cart / wishlist / checkout helpers (Step 3).
 *
 * Client-safe, pure functions. Money is always recomputed server-side in
 * src/app/api/orders/route.ts — the client totals here are for display
 * only and must never be trusted by the API.
 */
import {
  DELIVERY_CHARGES_FLAT,
  FREE_DELIVERY_THRESHOLD,
} from "./constants";

export interface CartItem {
  productId: string;
  productSlug: string;
  name: string;
  image: string;
  variantId: string;
  sku: string;
  size: string;
  color: string;
  /** Unit price in PKR, taken from the catalogue at add time. */
  price: number;
  /** Stock available for this variant at add time (re-checked at checkout). */
  stock: number;
  quantity: number;
}

export interface CouponResult {
  valid: boolean;
  code: string | null;
  /** Discount in PKR. */
  discount: number;
  message: string;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  discount: number;
  /** Delivery after the free-delivery rule. */
  delivery: number;
  total: number;
  coupon: CouponResult | null;
}

export const CART_STORAGE_KEY = "mf-cart-v1";
export const WISHLIST_STORAGE_KEY = "mf-wishlist-v1";

/**
 * WELCOME10 — the seeded coupon (see supabase/seed.sql): 10% off, minimum
 * order Rs 2,000. Validated locally for the cart display; the API route
 * re-validates it against Supabase when configured, otherwise this rule.
 */
export function validateCoupon(
  rawCode: string,
  subtotal: number,
): CouponResult {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { valid: false, code: null, discount: 0, message: "" };
  }
  if (code !== "WELCOME10") {
    return {
      valid: false,
      code,
      discount: 0,
      message: "This coupon code is not valid.",
    };
  }
  if (subtotal < 2000) {
    return {
      valid: false,
      code,
      discount: 0,
      message: "WELCOME10 needs a minimum order of Rs 2,000.",
    };
  }
  return {
    valid: true,
    code,
    discount: Math.round(subtotal * 0.1),
    message: "WELCOME10 applied — 10% off.",
  };
}

export function computeTotals(
  items: CartItem[],
  couponCode?: string | null,
): CartTotals {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const coupon = couponCode ? validateCoupon(couponCode, subtotal) : null;
  const discount = coupon?.valid ? coupon.discount : 0;
  const afterDiscount = subtotal - discount;
  const delivery =
    items.length === 0 || afterDiscount >= FREE_DELIVERY_THRESHOLD
      ? 0
      : DELIVERY_CHARGES_FLAT;
  return {
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    discount,
    delivery,
    total: afterDiscount + delivery,
    coupon,
  };
}

/** Loose Pakistani phone validation: 03XX-XXXXXXX, +92 3XX XXXXXXX, etc. */
export function isValidPakistaniPhone(phone: string): boolean {
  const digits = phone.replace(/[^\d]/g, "");
  // 03XXXXXXXXX (11 digits) or 92 3XXXXXXXXX (12 digits incl. country code)
  return (
    (digits.length === 11 && digits.startsWith("03")) ||
    (digits.length === 12 && digits.startsWith("92") && digits[2] === "3")
  );
}

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, " ");
}

/** Demo order numbers use the same MF-YYYYMMDD-XXXXX shape as the DB. */
export function generateDemoOrderNumber(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const seq = String(Math.floor(10000 + Math.random() * 90000));
  return `MF-${date}-${seq}`;
}
