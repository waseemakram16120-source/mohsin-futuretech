import { storeConfig } from "@/config/store";

const priceFormatter = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/** 4499 → "Rs 4,499". Prices are whole rupees in this store. */
export function formatPrice(amount: number): string {
  return `${storeConfig.currencySymbol} ${priceFormatter.format(Math.round(amount))}`;
}

/**
 * Percentage saved, rounded down so the badge never over-promises
 * (e.g. 7,999 vs 9,999 → 20%). Returns 0 when there is no real discount.
 */
export function discountPercent(price: number, compareAt: number | null | undefined): number {
  if (!compareAt || compareAt <= price || price <= 0) return 0;
  return Math.floor(((compareAt - price) / compareAt) * 100);
}

/**
 * Trim a list so a desktop grid shows only complete rows (e.g. 6 → 4 with
 * 4 columns). Lists shorter than one row are left as they are.
 */
export function fullRows<T>(items: T[], columns: number): T[] {
  if (items.length <= columns) return items;
  return items.slice(0, items.length - (items.length % columns));
}
