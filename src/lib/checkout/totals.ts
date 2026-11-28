/**
 * Order totals — mirrors public.place_order(). Shown in the cart and at
 * checkout; the database computes the authoritative amounts.
 */
export interface Totals {
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  /** Rupees still needed for free delivery (0 when already free). */
  toFreeDelivery: number;
  itemCount: number;
}

export function computeTotals(
  lines: Array<{ unitPrice: number; quantity: number }>,
  settings: { deliveryCharge: number; freeDeliveryMin: number },
  discount = 0,
): Totals {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const afterDiscount = subtotal - safeDiscount;
  const free = afterDiscount >= settings.freeDeliveryMin;
  const delivery = subtotal === 0 || free ? 0 : settings.deliveryCharge;
  return {
    subtotal,
    discount: safeDiscount,
    delivery,
    total: afterDiscount + delivery,
    toFreeDelivery: free ? 0 : Math.max(0, settings.freeDeliveryMin - afterDiscount),
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
  };
}
