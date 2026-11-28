import { formatPrice } from "@/lib/format";

/** Customer-facing text for coupon error codes from validate_coupon / place_order. */
export function couponMessage(code: string, minOrder?: number | null): string {
  switch (code) {
    case "coupon_min_order":
      return minOrder ? `This coupon needs an order of ${formatPrice(minOrder)} or more.` : "Your order is below this coupon's minimum.";
    case "coupon_expired":
      return "This coupon has expired.";
    case "coupon_not_started":
      return "This coupon is not active yet.";
    case "coupon_used_up":
      return "This coupon has reached its usage limit.";
    default:
      return "This coupon code is not valid.";
  }
}

/** Customer-facing text for place_order error codes. */
export function orderErrorMessage(code: string): string {
  if (code.startsWith("coupon_")) return couponMessage(code);
  switch (code) {
    case "out_of_stock":
      return "Some items in your bag no longer have enough stock. We've updated your bag — please review it.";
    case "variant_unavailable":
      return "An item in your bag is no longer available. Please remove it and try again.";
    case "invalid_quantity":
    case "invalid_item":
    case "too_many_items":
      return "Your bag has an invalid item or quantity. Please review it and try again.";
    case "cart_empty":
      return "Your bag is empty.";
    case "invalid_phone":
      return "Enter a valid Pakistani mobile number, e.g. 0300 1234567.";
    case "invalid_customer":
      return "Please check your name and delivery address.";
    default:
      return "We couldn't place your order right now. Please try again in a moment.";
  }
}

/** Error codes raised by the database that are safe to show (not internal errors). */
export const KNOWN_ORDER_ERRORS = new Set([
  "cart_empty", "too_many_items", "invalid_item", "invalid_phone", "invalid_customer",
  "invalid_quantity", "variant_unavailable", "out_of_stock", "coupon_invalid",
  "coupon_not_started", "coupon_expired", "coupon_used_up", "coupon_min_order",
]);
