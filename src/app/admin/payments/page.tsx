import type { Metadata } from "next";
import Link from "next/link";
import { PaymentReviewControl } from "@/components/admin/OrderActions";
import { AdminPageHeader, adminDate } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/States";
import { PAYMENT_METHOD_LABELS } from "@/config/store";
import { requireAdmin } from "@/lib/admin/auth";
import { codToCollect, paymentsToVerify } from "@/lib/admin/orders";
import { formatPkPhone } from "@/lib/checkout/phone";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Payments" };

export default async function AdminPaymentsPage() {
  await requireAdmin("/admin/payments");
  const [queue, cod] = await Promise.all([paymentsToVerify(), codToCollect()]);
  return (
    <div>
      <AdminPageHeader
        title="Payments"
        description="Check each EasyPaisa / JazzCash submission against your wallet app before approving. Approving confirms a pending order."
      />

      <section aria-labelledby="verify-title">
        <h2 id="verify-title" className="font-display text-2xl">
          Waiting for verification <span className="text-muted">({queue.length})</span>
        </h2>
        {queue.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon="wallet" title="All caught up" description="New payment submissions will appear here." />
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 lg:grid-cols-2" data-testid="verify-queue">
            {queue.map((p) => {
              const mismatch = Math.abs(p.amount - p.order.total_amount) > 0.001;
              return (
                <li key={p.id} className="flex flex-col rounded-card border border-stone bg-surface p-5" data-testid="verify-item">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/admin/orders/${p.order.order_number}`} className="font-mono font-semibold underline-offset-4 hover:underline">
                      {p.order.order_number}
                    </Link>
                    <span className="text-lg font-semibold tabular-nums">{formatPrice(p.order.total_amount)}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
                    <dt className="text-ink-soft">Customer</dt>
                    <dd>
                      {p.order.delivery_name} · {formatPkPhone(p.order.delivery_phone)}
                    </dd>
                    <dt className="text-ink-soft">Method</dt>
                    <dd>{PAYMENT_METHOD_LABELS[p.method]}</dd>
                    <dt className="text-ink-soft">Transaction ID</dt>
                    <dd className="font-mono" data-testid="payment-txn">
                      {p.transaction_id}
                    </dd>
                    {p.submitted_at ? (
                      <>
                        <dt className="text-ink-soft">Submitted</dt>
                        <dd>{adminDate.format(new Date(p.submitted_at))}</dd>
                      </>
                    ) : null}
                    {p.customer_note ? (
                      <>
                        <dt className="text-ink-soft">Note</dt>
                        <dd>{p.customer_note}</dd>
                      </>
                    ) : null}
                  </dl>
                  {mismatch ? (
                    <p className="mt-2 text-sm text-sale">Payment record amount ({formatPrice(p.amount)}) differs from the order total.</p>
                  ) : null}
                  {p.receiptUrl ? (
                    <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-4 block">
                      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
                      <img src={p.receiptUrl} alt={`Payment receipt for ${p.order.order_number}`} className="max-h-64 w-full rounded-xs border border-stone bg-sand/40 object-contain" />
                      <span className="mt-1 block text-xs underline">Open full size</span>
                    </a>
                  ) : (
                    <p className="mt-4 text-sm text-sale">Receipt image unavailable.</p>
                  )}
                  <div className="mt-4 border-t border-stone pt-4">
                    <PaymentReviewControl paymentId={p.id} canApprove={p.order.status !== "cancelled" && p.order.status !== "returned"} canMarkPaid={false} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="cod-title" id="cod" className="mt-12 scroll-mt-24">
        <h2 id="cod-title" className="font-display text-2xl">
          Cash on Delivery to collect <span className="text-muted">({cod.length})</span>
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Delivered COD orders not yet marked as paid.</p>
        {cod.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Nothing to collect.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone rounded-card border border-stone bg-surface" data-testid="cod-list">
            {cod.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-sm">
                  <Link href={`/admin/orders/${c.order.order_number}`} className="font-mono font-semibold underline-offset-4 hover:underline">
                    {c.order.order_number}
                  </Link>
                  <p className="text-ink-soft">
                    {c.order.delivery_name} · {c.order.city} · {formatPrice(c.amount)}
                  </p>
                </div>
                <PaymentReviewControl paymentId={c.id} canApprove={false} canMarkPaid />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
