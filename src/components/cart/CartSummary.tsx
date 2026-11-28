import type { ReactNode } from "react";
import type { Totals } from "@/lib/checkout/totals";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

export function FreeDeliveryProgress({ totals, freeDeliveryMin }: { totals: Totals; freeDeliveryMin: number }) {
  const done = totals.toFreeDelivery === 0 && totals.subtotal > 0;
  const pct = done ? 100 : Math.min(100, Math.round(((freeDeliveryMin - totals.toFreeDelivery) / freeDeliveryMin) * 100));
  return (
    <div className="rounded-card border border-stone bg-surface p-4" data-testid="free-delivery">
      <p className="text-sm">
        {done ? (
          <span className="font-semibold text-success">You&rsquo;ve unlocked free delivery.</span>
        ) : (
          <>
            Add <strong className="font-semibold">{formatPrice(totals.toFreeDelivery)}</strong> more for free delivery.
          </>
        )}
      </p>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand"
        role="progressbar"
        aria-label="Progress to free delivery"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", done ? "bg-success" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TotalsTable({ totals, couponCode, children }: { totals: Totals; couponCode?: string | null; children?: ReactNode }) {
  return (
    <dl className="space-y-3 text-sm" data-testid="totals">
      <div className="flex justify-between">
        <dt className="text-ink-soft">
          Subtotal ({totals.itemCount} {totals.itemCount === 1 ? "item" : "items"})
        </dt>
        <dd className="tabular-nums" data-testid="subtotal">{formatPrice(totals.subtotal)}</dd>
      </div>
      {totals.discount > 0 ? (
        <div className="flex justify-between text-success">
          <dt>Discount{couponCode ? ` (${couponCode})` : ""}</dt>
          <dd className="tabular-nums" data-testid="discount">−{formatPrice(totals.discount)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between">
        <dt className="text-ink-soft">Delivery</dt>
        <dd className="tabular-nums" data-testid="delivery">{totals.delivery === 0 ? "Free" : formatPrice(totals.delivery)}</dd>
      </div>
      {children}
      <div className="flex justify-between border-t border-stone pt-3 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular-nums" data-testid="total">{formatPrice(totals.total)}</dd>
      </div>
    </dl>
  );
}
