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
  contact: {
    // Placeholder values — replace from Admin → Settings.
    phone: "+92 300 0000000",
    whatsapp: "923000000000",
    email: "support@example.com",
    address: "Shop address, Karachi, Pakistan",
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
  uploads: {
    maxImageBytes: 5 * 1024 * 1024,
    allowedImageTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  },
} as const;

export const PAYMENT_METHODS = ["cod", "easypaisa", "jazzcash", "nayapay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const WALLET_METHODS = ["easypaisa", "jazzcash", "nayapay"] as const;
export type WalletMethod = (typeof WALLET_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  easypaisa: "EasyPaisa",
  jazzcash: "JazzCash",
  nayapay: "NayaPay",
};

export function isWalletMethod(method: string): method is WalletMethod {
  return (WALLET_METHODS as readonly string[]).includes(method);
}
