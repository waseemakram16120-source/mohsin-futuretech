"use client";

import Link from "next/link";
import { ProductImage } from "@/components/product/ProductImage";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/config/store";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import type { QuoteLine } from "@/lib/orders/quote";
import { MAX_QTY, cartStore, removeFromCart, setLineQuantity, updateCartQuantity } from "@/lib/stores/cart";
import { CouponForm } from "./CouponForm";
import { FreeDeliveryProgress, TotalsTable } from "./CartSummary";
import { useQuote } from "./useQuote";

const ISSUE_TEXT: Record<Exclude<QuoteLine["status"], "ok">, (l: QuoteLine) => string> = {
  unavailable: () => "This item is no longer available.",
  out_of_stock: () => "Sold out in this size and colour.",
  limited: (l) => `Only ${l.stock} left — quantity will be reduced to ${l.stock}.`,
};

/** Apply the fixes the quote suggests: drop unavailable lines, cap quantities. */
function fixBag(lines: QuoteLine[]) {
  cartStore.set((current) => {
    let next = current;
    for (const l of lines) {
      if (l.status === "unavailable" || l.status === "out_of_stock") next = next.filter((c) => c.variantId !== l.variantId);
      if (l.status === "limited") next = setLineQuantity(next, l.variantId, l.stock);
    }
    return next;
  });
}

function LineRow({ line, busy }: { line: QuoteLine; busy: boolean }) {
  const max = Math.max(1, Math.min(MAX_QTY, line.stock || 1));
  const problem = line.status !== "ok";
  return (
    <li className="flex gap-4 py-5" data-testid="cart-line">
      <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xs bg-sand sm:w-28">
        {line.image ? <ProductImage src={line.image.url} alt={line.image.alt} fill sizes="112px" className="object-cover" /> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {line.productSlug ? (
              <Link href={`/products/${line.productSlug}?color=${encodeURIComponent(line.color ?? "")}&size=${encodeURIComponent(line.size ?? "")}`} className="font-medium hover:underline">
                {line.productName}
              </Link>
            ) : (
              <p className="font-medium text-muted">Unavailable item</p>
            )}
            {line.color ? (
              <p className="mt-1 text-sm text-ink-soft">
                {line.color} · Size {line.size}
              </p>
            ) : null}
            {line.sku ? <p className="mt-0.5 font-mono text-xs text-muted">{line.sku}</p> : null}
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(line.unitPrice * Math.max(line.quantity, 0))}</p>
        </div>

        {problem ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-sale" role="status">
            <Icon name="alert" className="size-4" /> {ISSUE_TEXT[line.status as Exclude<QuoteLine["status"], "ok">](line)}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          {line.status === "unavailable" || line.status === "out_of_stock" ? (
            <span />
          ) : (
            <div className="flex h-10 items-center rounded-xs border border-stone-strong bg-surface" role="group" aria-label={`Quantity for ${line.productName}`}>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center disabled:text-stone-strong"
                aria-label="Decrease quantity"
                disabled={busy || line.requested <= 1}
                onClick={() => updateCartQuantity(line.variantId, line.requested - 1)}
              >
                −
              </button>
              <output className="w-8 text-center text-sm font-semibold tabular-nums" aria-label="Quantity">
                {line.requested}
              </output>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center disabled:text-stone-strong"
                aria-label="Increase quantity"
                disabled={busy || line.requested >= max}
                onClick={() => updateCartQuantity(line.variantId, line.requested + 1)}
              >
                +
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => removeFromCart(line.variantId)}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            aria-label={`Remove ${line.productName ?? "item"} from bag`}
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export function CartSkeleton() {
  return (
    <div role="status" aria-live="polite" className="grid gap-10 lg:grid-cols-[1fr_24rem]">
      <span className="sr-only">Loading your bag…</span>
      <div className="divide-y divide-stone">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4 py-5">
            <Skeleton className="aspect-[3/4] w-24 sm:w-28" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export function CartView({ methods }: { methods: readonly PaymentMethod[] }) {
  const { state, lines, hydrated, coupon, retry } = useQuote();
  const quote = state.quote;
  const loading = state.status === "loading";

  if (!hydrated || (loading && !quote)) return <CartSkeleton />;

  if (lines.length === 0) {
    return (
      <EmptyState
        icon="bag"
        title="Your bag is empty"
        description="Browse the new season and add your favourite pieces."
        action={<ButtonLink href="/new-arrivals">Shop new arrivals</ButtonLink>}
      />
    );
  }

  if (state.status === "error" && !quote) {
    return <ErrorState title="We couldn't load your bag" description={state.message} action={<Button onClick={retry}>Try again</Button>} />;
  }
  if (!quote) return <CartSkeleton />;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-14">
      <section aria-labelledby="bag-items">
        <h2 id="bag-items" className="sr-only">
          Items in your bag
        </h2>
        {quote.hasIssues ? (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
            <p className="font-medium">Some items changed since you added them.</p>
            <Button size="sm" variant="secondary" onClick={() => fixBag(quote.lines)}>
              Update my bag
            </Button>
          </div>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="mb-4 text-sm text-sale">
            {state.message}{" "}
            <button type="button" className="underline" onClick={retry}>
              Retry
            </button>
          </p>
        ) : null}
        <ul className={cn("divide-y divide-stone border-y border-stone transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          {quote.lines.map((line) => (
            <LineRow key={line.variantId} line={line} busy={loading} />
          ))}
        </ul>
        <Link href="/shop" className="mt-6 inline-flex items-center gap-2 text-sm font-medium hover:underline">
          <Icon name="arrowRight" className="size-4 rotate-180" /> Continue shopping
        </Link>
      </section>

      <aside aria-labelledby="summary-title" className="lg:sticky lg:top-24 lg:self-start">
        <div className="space-y-5 rounded-card border border-stone bg-surface p-5 sm:p-6">
          <h2 id="summary-title" className="font-display text-2xl">
            Order summary
          </h2>
          <FreeDeliveryProgress totals={quote.totals} freeDeliveryMin={quote.freeDeliveryMin} />
          <CouponForm coupon={quote.coupon} loading={loading} />
          <TotalsTable totals={quote.totals} couponCode={quote.coupon?.valid ? quote.coupon.code : coupon} />
          {quote.hasIssues ? (
            <Button size="lg" className="w-full" disabled>
              Update your bag to continue
            </Button>
          ) : (
            <ButtonLink href="/checkout" size="lg" className="w-full" aria-disabled={loading}>
              Checkout securely
            </ButtonLink>
          )}
          <p className="text-center text-xs text-muted">
            Pay with {methods.map((m) => PAYMENT_METHOD_LABELS[m]).join(" · ")}
          </p>
        </div>
      </aside>
    </div>
  );
}
