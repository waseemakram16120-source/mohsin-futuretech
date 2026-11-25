/**
 * Order totals box shared by the cart and checkout pages (Step 3).
 * Delivery: Rs 200 flat, free on orders of Rs 5,000 or more (after discount).
 */
import { formatPKR } from "@/lib/constants";
import type { CartTotals } from "@/lib/cart";

export default function OrderSummary({ totals }: { totals: CartTotals }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between">
        <dt className="text-zinc-600">Subtotal ({totals.itemCount} item{totals.itemCount === 1 ? "" : "s"})</dt>
        <dd className="font-semibold text-zinc-900">{formatPKR(totals.subtotal)}</dd>
      </div>
      {totals.discount > 0 && (
        <div className="flex justify-between text-emerald-700">
          <dt>Discount{totals.coupon?.code ? ` (${totals.coupon.code})` : ""}</dt>
          <dd className="font-semibold">− {formatPKR(totals.discount)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-zinc-600">Delivery charges</dt>
        <dd className="font-semibold text-zinc-900">
          {totals.delivery === 0 ? "Free" : formatPKR(totals.delivery)}
        </dd>
      </div>
      <div className="flex justify-between border-t border-zinc-200 pt-3 text-base">
        <dt className="font-bold text-zinc-900">Total</dt>
        <dd className="font-extrabold text-[#0f2440]">{formatPKR(totals.total)}</dd>
      </div>
      <p className="text-xs text-zinc-500">
        Free delivery on orders of Rs 5,000 or more (after discount).
      </p>
    </dl>
  );
}
