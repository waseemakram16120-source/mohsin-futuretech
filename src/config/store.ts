/**
 * Store configuration — the ONE place for brand and contact defaults.
 *
 * Everything here is a placeholder until the client supplies real details.
 * At runtime the values in the `store_settings` table (editable by an admin
 * from Admin → Settings) take priority; these defaults are used when the
 * database row is missing a value or Supabase is not reachable.
 *
 * Wallet account numbers are intentionally NOT stored here: they are set in
 * Admin → Settings (database) so they can change without a redeploy.
 */

export const storeConfig = {
  name: "Mohsin FutureTech",
  shortName: "MFT",
  tagline: "Modern menswear & womenswear, delivered across Pakistan.",
  currency: "PKR",
  currencySymbol: "Rs",
  locale: "en-PK",
  timeZone: "Asia/Karachi",
  /** Store owner (client): Muhammad Waseem. */
  owner: "Muhammad Waseem",
  contact: {
    // Provided by the client. Admin → Settings (database) overrides these.
    phone: "+92 308 2340478",
    whatsapp: "923082340478", // wa.me format
    email: "mwbusiness.com12@gmail.com",
    address: "Korangi Industrial Area, Karachi, Pakistan",
  },
  social: {
    instagram: "",
    facebook: "",
    tiktok: "",
  },
  delivery: {
    /** Flat delivery charge in PKR (default; DB setting overrides). */
    charge: 250,
    /** Orders at or above this subtotal (after discount) ship free. */
    freeDeliveryMin: 5000,
    estimate: "3–5 working days",
  },
  inventory: {
    /** Variants at or below this quantity show as "low stock". */
    lowStockThreshold: 5,
  },
  cart: {
    /** Maximum quantity of one variant per order line. */
    maxQuantityPerLine: 10,
  },
  wishlist: {
    /** Maximum saved products (browser and account). */
    maxItems: 100,
  },
  uploads: {
    maxImageBytes: 5 * 1024 * 1024,
    allowedImageTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  },
} as const;

/** Every method the database knows (includes retired NayaPay for old orders). */
export const ALL_PAYMENT_METHODS = ["cod", "easypaisa", "jazzcash", "nayapay"] as const;
export type AnyPaymentMethod = (typeof ALL_PAYMENT_METHODS)[number];

/** Methods offered at checkout. JazzCash/Easypaisa also need an enabled gateway. */
export const PAYMENT_METHODS = ["cod", "jazzcash", "easypaisa"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Methods paid online through a direct merchant gateway. */
export const GATEWAY_METHODS = ["jazzcash", "easypaisa"] as const;
export type GatewayMethod = (typeof GATEWAY_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<AnyPaymentMethod, string> = {
  cod: "Cash on Delivery",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  nayapay: "NayaPay",
};

export function isGatewayMethod(method: string): method is GatewayMethod {
  return (GATEWAY_METHODS as readonly string[]).includes(method);
}
