import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusControl, PaymentReviewControl } from "@/components/admin/OrderActions";
import { AdminPageHeader, OrderStatusBadge, PaymentStatusBadge, adminDate } from "@/components/admin/ui";
import { TotalsTable } from "@/components/cart/CartSummary";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { ProductImage } from "@/components/product/ProductImage";
import { PAYMENT_METHOD_LABELS, isGatewayMethod } from "@/config/store";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminOrder } from "@/lib/admin/orders";
import { formatPkPhone } from "@/lib/checkout/phone";
import { ORDER_STATUS_LABELS } from "@/lib/domain";
import { formatPrice } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Order ${(await params).number.toUpperCase()}` };
}

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="rounded-card border border-stone bg-surface p-5 sm:p-6" aria-label={title} data-testid={testId}>
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AdminOrderPage({ params }: Props) {
  const number = (await params).number.toUpperCase();
  await requireAdmin(`/admin/orders/${number}`);
  const order = await getAdminOrder(number);
  if (!order) notFound();

  const current = order.payments.at(-1) ?? null;
  const wallet = isGatewayMethod(order.payment_method);
  const closed = order.status === "cancelled" || order.status === "returned";
  const canApprove = current?.status === "pending_verification" && !closed;
  const canMarkPaid = current !== null && (current.status === "due" || current.status === "approved") && !closed;
  const wa = whatsappLink(order.delivery_phone.replace(/^0/, "92"), `Hi ${order.delivery_name}, this is about your order ${order.order_number}.`);
  const totals = {
    subtotal: order.subtotal,
    discount: order.discount_amount,
    delivery: order.delivery_charge,
    total: order.total_amount,
    toFreeDelivery: 0,
    itemCount: order.order_items.reduce((n, i) => n + i.quantity, 0),
  };

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/admin/orders" className="underline underline-offset-4">
          ← All orders
        </Link>
      </p>
      <AdminPageHeader
        title={order.order_number}
        description={`Placed ${adminDate.format(new Date(order.created_at))} · ${PAYMENT_METHOD_LABELS[order.payment_method]} · ${order.user_id ? "Registered customer" : "Guest checkout"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Section title="Update status" testId="admin-status">
            <OrderStatusControl orderId={order.id} status={order.status} walletUnverified={wallet && order.payment_status !== "approved" && order.payment_status !== "paid"} />
          </Section>

          <Section title="Payment" testId="admin-payment">
            {order.payments.length === 0 ? (
              <p className="text-sm text-ink-soft">No payment record.</p>
            ) : (
              <ol className="space-y-4">
                {order.payments.map((p, i) => {
                  const latest = i === order.payments.length - 1;
                  return (
                    <li key={p.id} className={latest ? "" : "opacity-75"} data-testid="payment-record">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <PaymentStatusBadge status={p.status} />
                        <span className="font-semibold tabular-nums">{formatPrice(p.amount)}</span>
                        <span className="text-muted">{latest ? "Current record" : "Earlier submission"}</span>
                      </div>
                      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
                        {p.transaction_id ? (
                          <>
                            <dt className="text-ink-soft">Transaction ID</dt>
                            <dd className="font-mono" data-testid="payment-txn">
                              {p.transaction_id}
                            </dd>
                          </>
                        ) : null}
                        {p.submitted_at ? (
                          <>
                            <dt className="text-ink-soft">Submitted</dt>
                            <dd>{adminDate.format(new Date(p.submitted_at))}</dd>
                          </>
                        ) : null}
                        {p.customer_note ? (
                          <>
                            <dt className="text-ink-soft">Customer note</dt>
                            <dd>{p.customer_note}</dd>
                          </>
                        ) : null}
                        {p.reviewed_at ? (
                          <>
                            <dt className="text-ink-soft">Reviewed</dt>
                            <dd>
                              {adminDate.format(new Date(p.reviewed_at))}
                              {p.reviewer ? ` by ${p.reviewer.full_name || p.reviewer.email}` : ""}
                            </dd>
                          </>
                        ) : null}
                        {p.review_note ? (
                          <>
                            <dt className="text-ink-soft">Review note</dt>
                            <dd>{p.review_note}</dd>
                          </>
                        ) : null}
                      </dl>
                      {p.receiptUrl ? (
                        <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block" data-testid="receipt-link">
                          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
                          <img src={p.receiptUrl} alt={`Payment receipt for ${order.order_number}`} className="max-h-72 rounded-xs border border-stone object-contain" />
                          <span className="mt-1 block text-xs underline">Open full size (link valid for 1 hour)</span>
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
            {current ? (
              <div className="mt-5 border-t border-stone pt-5">
                {wallet && current.status === "pending_verification" ? (
                  <p className="mb-3 text-sm text-ink-soft">
                    Check that {formatPrice(order.total_amount)} with this Transaction ID reached the store&rsquo;s {PAYMENT_METHOD_LABELS[order.payment_method]} account before approving.
                  </p>
                ) : null}
                {current.status === "due" && order.status !== "delivered" && !closed ? (
                  <p className="mb-3 text-sm text-ink-soft">Cash on Delivery: mark as paid once the rider has collected the cash.</p>
                ) : null}
                <PaymentReviewControl paymentId={current.id} canApprove={canApprove} canMarkPaid={canMarkPaid} />
              </div>
            ) : null}
          </Section>

          <Section title="Items">
            <ul className="divide-y divide-stone">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-xs bg-sand">
                    {item.image_url ? <ProductImage src={item.image_url} alt="" fill sizes="56px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-ink-soft">
                      {item.color} · Size {item.size} · Qty {item.quantity} × {formatPrice(item.unit_price)}
                    </p>
                    <p className="font-mono text-xs text-muted">{item.sku}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatPrice(item.line_total)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-stone pt-4">
              <TotalsTable totals={totals} couponCode={order.coupon_code} />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Customer & delivery">
            <address className="text-sm leading-relaxed not-italic">
              <span className="font-medium">{order.delivery_name}</span>
              <br />
              <a href={`tel:${order.delivery_phone}`} className="underline underline-offset-4">
                {formatPkPhone(order.delivery_phone)}
              </a>
              {wa ? (
                <>
                  {" · "}
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    WhatsApp
                  </a>
                </>
              ) : null}
              {order.customer_email ? (
                <>
                  <br />
                  {order.customer_email}
                </>
              ) : null}
              <br />
              <span className="mt-2 block text-ink-soft">
                {order.delivery_address}
                <br />
                {[order.city, order.province, order.postal_code].filter(Boolean).join(", ")}
              </span>
            </address>
            {order.notes ? (
              <p className="mt-3 rounded-xs bg-sand/60 p-3 text-sm">
                <span className="font-medium">Customer note:</span> {order.notes}
              </p>
            ) : null}
            {order.user_id ? (
              <Link href={`/admin/customers/${order.user_id}`} className="mt-3 inline-block text-sm underline underline-offset-4">
                View customer
              </Link>
            ) : null}
          </Section>

          <Section title="Progress">
            <OrderTimeline status={order.status} history={order.order_status_history} />
          </Section>

          <Section title="History">
            <ol className="space-y-3 text-sm" data-testid="status-history">
              {order.order_status_history.map((h, i) => (
                <li key={i}>
                  <p>
                    {h.from_status ? `${ORDER_STATUS_LABELS[h.from_status]} → ` : ""}
                    <strong>{ORDER_STATUS_LABELS[h.to_status]}</strong>
                  </p>
                  <p className="text-xs text-muted">
                    {adminDate.format(new Date(h.created_at))}
                    {h.changed_by_profile ? ` · ${h.changed_by_profile.full_name || h.changed_by_profile.email}` : " · system"}
                  </p>
                  {h.note ? <p className="text-xs text-ink-soft">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
