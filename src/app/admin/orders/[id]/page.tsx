/**
 * /admin/orders/[id] — order detail (PDF §5): customer + delivery info,
 * items, totals, payment evidence, status timeline, and the status
 * update control (PDF §7 workflow).
 */
"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { adminGet, adminSend } from "@/lib/admin-client";
import {
  adminUpdateDemoOrderStatus,
  getDemoAdminOrders,
} from "@/lib/admin-data";
import type { AdminOrder } from "@/lib/admin-types";
import { formatPKR, ORDER_STATUSES } from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";
import OrderTimeline from "@/components/OrderTimeline";
import {
  ErrorState,
  LoadingState,
  OrderStatusBadge,
  PageTitle,
  PaymentStatusBadge,
} from "@/components/admin-ui";

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    adminGet(`/api/admin/orders/${id}`)
      .then((json) => {
        if (json.mode === "live" && json.order) {
          setOrder(json.order as AdminOrder);
        } else {
          const found =
            getDemoAdminOrders().find((o) => o.id === id || o.orderNumber === id) ?? null;
          setOrder(found);
          if (!found) setNotFound(true);
        }
      })
      .catch(() => {
        const found =
          getDemoAdminOrders().find((o) => o.id === id || o.orderNumber === id) ?? null;
        setOrder(found);
        if (!found) setNotFound(true);
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(next: OrderStatus) {
    if (!order) return;
    setSaving(true);
    setMessage(null);
    try {
      const json = await adminSend(`/api/admin/orders/${order.id}`, "PATCH", {
        status: next,
      });
      if (json.mode === "demo") {
        const updated = adminUpdateDemoOrderStatus(order.orderNumber, next);
        if (updated) setOrder(updated);
      } else {
        load();
      }
      setMessage(`Order status updated to ${next}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update the status.");
    } finally {
      setSaving(false);
    }
  }

  if (notFound) return <ErrorState message="Order not found." />;
  if (!order) return <LoadingState label="Loading order…" />;

  return (
    <div>
      <PageTitle
        title={`Order ${order.orderNumber}`}
        subtitle={`Placed ${new Date(order.createdAt).toLocaleString("en-PK")}`}
        action={<Link href="/admin/orders" className="text-sm text-sky-700 underline">← All orders</Link>}
      />

      {message && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.paymentStatus} />
        <span className="text-sm capitalize text-zinc-500">
          {order.paymentMethod === "cod" ? "Cash on Delivery" : order.paymentMethod}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-[#0f2440]">Customer &amp; delivery</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Name</dt><dd className="font-medium">{order.customerName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Phone</dt><dd>{order.phone}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Address</dt><dd className="text-right">{order.address}, {order.city}</dd></div>
            {order.province && <div className="flex justify-between gap-4"><dt className="text-zinc-500">Province</dt><dd>{order.province}</dd></div>}
            {order.postalCode && <div className="flex justify-between gap-4"><dt className="text-zinc-500">Postal code</dt><dd>{order.postalCode}</dd></div>}
            {order.couponCode && <div className="flex justify-between gap-4"><dt className="text-zinc-500">Coupon</dt><dd>{order.couponCode}</dd></div>}
            {order.notes && <div className="flex justify-between gap-4"><dt className="text-zinc-500">Notes</dt><dd className="text-right">{order.notes}</dd></div>}
          </dl>

          <h3 className="mb-2 mt-4 font-semibold text-[#0f2440]">Payment evidence</h3>
          {order.paymentMethod === "cod" ? (
            <p className="text-sm text-zinc-600">
              Cash on Delivery — payment is {order.paymentStatus === "paid" ? "Paid" : "Due on Delivery"}.
              Mark it paid from the Payments page after delivery.
            </p>
          ) : order.transactionId ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Transaction ID</dt><dd className="font-mono">{order.transactionId}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Receipt</dt><dd>{order.receiptUrl ? <a href={order.receiptUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">View screenshot</a> : (order.receiptFileName ?? "—")}</dd></div>
              {order.paymentReviewNote && <div className="flex justify-between gap-4"><dt className="text-zinc-500">Review note</dt><dd className="text-right">{order.paymentReviewNote}</dd></div>}
              <dd><Link href="/admin/payments" className="text-sky-700 underline">Review in Payments →</Link></dd>
            </dl>
          ) : (
            <p className="text-sm text-zinc-600">
              No payment evidence submitted yet. The customer can submit it from
              their order page.
            </p>
          )}
        </section>

        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-[#0f2440]">Items</h2>
          <ul className="divide-y">
            {order.items.map((item, i) => (
              <li key={`${item.sku ?? item.productName}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                {item.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="h-12 w-12 rounded object-cover" />
                )}
                <span className="flex-1">
                  {item.productName}
                  <span className="block text-xs text-zinc-500">
                    {item.variantLabel ?? ""} {item.sku ? `· ${item.sku}` : ""} × {item.quantity}
                  </span>
                </span>
                <span className="font-semibold">{formatPKR(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-zinc-500">Subtotal</dt><dd>{formatPKR(order.subtotal)}</dd></div>
            {order.discountAmount > 0 && <div className="flex justify-between"><dt className="text-zinc-500">Discount</dt><dd>−{formatPKR(order.discountAmount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-zinc-500">Delivery</dt><dd>{order.deliveryCharges === 0 ? "Free" : formatPKR(order.deliveryCharges)}</dd></div>
            <div className="flex justify-between font-bold"><dt>Total</dt><dd>{formatPKR(order.totalAmount)}</dd></div>
          </dl>

          <h3 className="mb-2 mt-4 font-semibold text-[#0f2440]">Update order status</h3>
          <div className="flex flex-wrap gap-2">
            <select
              value={order.status}
              disabled={saving}
              onChange={(e) => void updateStatus(e.target.value as OrderStatus)}
              className="rounded border px-3 py-2 text-sm"
              aria-label="Update order status"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label} — {s.description}</option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <OrderTimeline status={order.status} />
          </div>
        </section>
      </div>
    </div>
  );
}
