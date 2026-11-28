import type { Metadata } from "next";
import Link from "next/link";
import { PAYMENT_METHOD_LABELS, isGatewayMethod } from "@/config/store";
import { ManualPaymentPanel } from "@/components/payments/ManualPaymentPanel";
import { PaymentPanel } from "@/components/payments/PaymentPanel";
import { TotalsTable } from "@/components/cart/CartSummary";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { Breadcrumbs } from "@/components/listing/ListingPage";
import { ProductImage } from "@/components/product/ProductImage";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getStoreSettings } from "@/lib/catalog/queries";
import { formatPkPhone } from "@/lib/checkout/phone";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/domain";
import { formatPrice } from "@/lib/format";
import { getOrderPlacedHere } from "@/lib/orders/queries";
import { evidenceState } from "@/lib/payments/manual";
import { isWalletAccountConfigured } from "@/lib/payments/methods";
import { providerFor, walletMode } from "@/lib/payments/registry";
import { paymentState } from "@/lib/payments/service";
import type { AttemptStatus } from "@/lib/payments/status";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ placed?: string; payment?: string }> };

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(new Date(iso));
}

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ number }, { placed, payment }] = await Promise.all([params, searchParams]);
  const [order, settings] = await Promise.all([getOrderPlacedHere(number), getStoreSettings()]);

  if (!order) {
    const help = whatsappLink(settings.whatsapp, `Hi, I need help with order ${number.toUpperCase()}.`);
    return (
      <div className="container-page flex flex-col items-center py-24 text-center">
        <Icon name="box" className="size-10 text-muted" />
        <h1 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">We can&rsquo;t show this order here</h1>
        <p className="mt-3 max-w-md text-ink-soft">
          For your privacy, order details are only shown on the device that placed the order or to the signed-in account
          that owns it. You can look it up with your order number and phone number instead.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/track">Track an order</ButtonLink>
          <ButtonLink href={`/login?next=${encodeURIComponent(`/orders/${number.toUpperCase()}`)}`} variant="secondary">
            Sign in
          </ButtonLink>
          {help ? (
            <ButtonLink href={help} variant="secondary" target="_blank" rel="noopener noreferrer">
              Ask on WhatsApp
            </ButtonLink>
          ) : null}
        </div>
      </div>
    );
  }

  const wallet = isGatewayMethod(order.payment_method) ? order.payment_method : null;
  // Manual wallets (proposal §4), or evidence already under review.
  const manual = wallet !== null && (walletMode(wallet) === "manual" || order.payment_status === "pending_verification");
  const gateway = wallet !== null && !manual ? wallet : null;
  const state = gateway ? await paymentState(order.order_number) : null;
  const provider = gateway ? providerFor(gateway) : null;
  const evidence = manual ? await evidenceState(order.id) : null;
  const liveSettings = manual ? await getStoreSettings({ live: true }) : null;
  const walletAccount = wallet && liveSettings ? liveSettings.wallets[wallet] : null;
  const totals = {
    subtotal: order.subtotal,
    discount: order.discount_amount,
    delivery: order.delivery_charge,
    total: order.total_amount,
    toFreeDelivery: 0,
    itemCount: order.order_items.reduce((n, i) => n + i.quantity, 0),
  };

  return (
    <div className="container-page py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: `Order ${order.order_number}` }]} />

      <div className="mt-8 rounded-card bg-ink px-6 py-8 text-surface sm:px-10 sm:py-10">
        {placed ? (
          <p className="flex items-center gap-2 text-sm text-surface/80">
            <Icon name="shield" className="size-4" /> Order placed successfully
          </p>
        ) : null}
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight sm:text-4xl">
          {placed ? `Thank you, ${order.delivery_name.split(" ")[0]}!` : "Your order"}
        </h1>
        <p className="mt-4 text-surface/80">Your order number is</p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-wide sm:text-3xl" data-testid="order-number">
          {order.order_number}
        </p>
        <p className="mt-4 text-sm text-surface/70">
          Placed {formatDate(order.created_at)}. Keep this number to track your order.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone="neutral">Order: {ORDER_STATUS_LABELS[order.status]}</Badge>
          <Badge tone={order.payment_status === "pending_verification" ? "warning" : "neutral"}>
            Payment: {PAYMENT_STATUS_LABELS[order.payment_status]}
          </Badge>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-14">
        <div className="space-y-10">
          <section aria-labelledby="next-steps" className="rounded-card border border-stone bg-surface p-5 sm:p-6">
            <h2 id="next-steps" className="font-display text-2xl">
              What happens next
            </h2>
            {manual && wallet ? (
              <ManualPaymentPanel
                orderNumber={order.order_number}
                method={wallet}
                amount={order.total_amount}
                account={
                  walletAccount && isWalletAccountConfigured(walletAccount)
                    ? { accountName: walletAccount.accountName!, accountNumber: walletAccount.accountNumber! }
                    : null
                }
                initial={{
                  paymentStatus: order.payment_status,
                  orderStatus: order.status,
                  transactionId: evidence?.transaction_id ?? null,
                  submittedAt: evidence?.submitted_at ?? null,
                  reviewNote: evidence?.review_note ?? null,
                }}
              />
            ) : gateway && state ? (
              <>
                {provider?.id === "test" ? (
                  <p className="mt-3 rounded-xs border border-warning/40 bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
                    Sandbox mode: payments use the internal TEST gateway — no real money is charged.
                  </p>
                ) : null}
                <PaymentPanel
                  orderNumber={order.order_number}
                  method={gateway}
                  available={provider !== null}
                  returned={payment === "return"}
                  initial={{
                    paymentStatus: state.payment_status,
                    orderStatus: state.order_status,
                    totalMinor: Number(state.total_minor),
                    attempt: state.latest_attempt
                      ? { status: state.latest_attempt.status as AttemptStatus, failureMessage: state.latest_attempt.failure_message }
                      : null,
                  }}
                />
              </>
            ) : (
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                <li>Our team reviews and confirms your order (we may call {formatPkPhone(order.delivery_phone)}).</li>
                <li>Your parcel is packed and dispatched.</li>
                <li>
                  Pay <strong>{formatPrice(order.total_amount)}</strong> in cash when it arrives.
                </li>
              </ol>
            )}
          </section>

          <section aria-labelledby="progress-title" className="rounded-card border border-stone bg-surface p-5 sm:p-6">
            <h2 id="progress-title" className="font-display text-2xl">
              Order progress
            </h2>
            <div className="mt-5">
              <OrderTimeline status={order.status} history={order.order_status_history} />
            </div>
          </section>

          <section aria-labelledby="items-title">
            <h2 id="items-title" className="font-display text-2xl">
              Items
            </h2>
            <ul className="mt-4 divide-y divide-stone border-y border-stone">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex gap-4 py-4" data-testid="order-item">
                  <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-xs bg-sand">
                    {item.image_url ? <ProductImage src={item.image_url} alt="" fill sizes="64px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    {item.product_slug ? (
                      <Link href={`/products/${item.product_slug}`} className="font-medium hover:underline">
                        {item.product_name}
                      </Link>
                    ) : (
                      <p className="font-medium">{item.product_name}</p>
                    )}
                    <p className="mt-1 text-ink-soft">
                      {item.color} · Size {item.size} · Qty {item.quantity}
                    </p>
                    <p className="font-mono text-xs text-muted">{item.sku}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatPrice(item.line_total)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <section aria-labelledby="order-total" className="rounded-card border border-stone bg-surface p-5 sm:p-6">
            <h2 id="order-total" className="font-display text-2xl">
              Payment summary
            </h2>
            <div className="mt-4">
              <TotalsTable totals={totals} couponCode={order.coupon_code} />
            </div>
            <p className="mt-4 text-sm text-ink-soft">Payment method: {PAYMENT_METHOD_LABELS[order.payment_method]}</p>
          </section>
          <section aria-labelledby="deliver-to" className="rounded-card border border-stone bg-surface p-5 text-sm sm:p-6">
            <h2 id="deliver-to" className="font-display text-2xl">
              Delivering to
            </h2>
            <address className="mt-3 leading-relaxed not-italic text-ink-soft">
              <span className="font-medium text-ink">{order.delivery_name}</span>
              <br />
              {order.delivery_address}
              <br />
              {[order.city, order.province, order.postal_code].filter(Boolean).join(", ")}
              <br />
              {formatPkPhone(order.delivery_phone)}
            </address>
          </section>
          <ButtonLink href="/shop" variant="secondary" className="w-full">
            Continue shopping
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}
