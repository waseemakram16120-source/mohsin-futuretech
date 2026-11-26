/**
 * Order detail (Step 3) — /account/orders/[orderNumber].
 *
 * Resolves a live order via GET /api/orders (owner session, no phone
 * needed) or a demo order from localStorage.
 */
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { formatPKR, PAYMENT_METHODS } from "@/lib/constants";
import { findDemoOrder, type DemoOrder } from "@/lib/demo-orders";
import type { OrderWithDetails } from "@/lib/types";
import OrderTimeline from "@/components/OrderTimeline";
import PaymentStatusCard from "@/components/PaymentStatusCard";

function OrderDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const orderNumber = decodeURIComponent(params.id ?? "");
  // Guests arrive here from /track with the delivery phone they already
  // verified — the API needs it to release a guest order.
  const phone = searchParams.get("phone") ?? "";
  const [demoOrder, setDemoOrder] = useState<DemoOrder | null>(null);
  const [liveOrder, setLiveOrder] = useState<OrderWithDetails | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!orderNumber) return;
    const demo = findDemoOrder(orderNumber);
    if (demo) {
      setDemoOrder(demo);
      setLoaded(true);
      return;
    }
    const query = phone
      ? `?number=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`
      : `?number=${encodeURIComponent(orderNumber)}`;
    fetch(`/api/orders${query}`)
      .then((r) => r.json())
      .then((result) => {
        if (result?.found) setLiveOrder(result.order as OrderWithDetails);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoaded(true));
  }, [orderNumber, phone]);

  if (!loaded) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-zinc-600">Loading your order…</p>
      </main>
    );
  }

  if (notFound || (!demoOrder && !liveOrder)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-zinc-900">Order not found</h1>
        <p className="mt-2 text-zinc-600">
          We could not find order {orderNumber} on this account or device.
        </p>
        <Link
          href={phone ? `/track?order=${encodeURIComponent(orderNumber)}` : "/account"}
          className="mt-6 inline-block rounded-full bg-[#0f2440] px-6 py-3 text-sm font-bold text-white"
        >
          {phone ? "Back to Track Order" : "Back to My Account"}
        </Link>
      </main>
    );
  }

  const status = demoOrder?.status ?? liveOrder!.status;
  const paymentMethod = demoOrder?.paymentMethod ?? liveOrder!.payment_method;
  const paymentStatus = demoOrder?.paymentStatus ?? liveOrder!.payments?.[0]?.status;
  const methodLabel = PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label ?? "—";
  const livePayment = liveOrder?.payments?.[0];
  const txnOnFile =
    demoOrder?.paymentSubmission?.transactionId ?? livePayment?.transaction_id ?? null;
  const receiptName =
    demoOrder?.paymentSubmission?.receiptFileName ??
    (livePayment?.receipt_url ? livePayment.receipt_url.split("/").pop() ?? null : null);
  const submittedAt =
    demoOrder?.paymentSubmission?.submittedAt ??
    (txnOnFile ? livePayment?.updated_at ?? null : null);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/account" className="text-sm font-semibold text-[#0f2440] hover:underline">
        ← Back to My Account
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-zinc-900">Order {orderNumber}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Placed on{" "}
        {new Date(demoOrder?.createdAt ?? liveOrder!.created_at).toLocaleDateString("en-PK", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        {demoOrder ? " · Demo order (saved in this browser)" : ""}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 p-5">
          <h2 className="text-lg font-bold text-zinc-900">Delivery</h2>
          <p className="mt-2 text-sm text-zinc-700">
            {demoOrder?.deliveryName ?? liveOrder!.delivery_name}
            <br />
            {demoOrder?.deliveryAddress ?? liveOrder!.delivery_address}
            <br />
            {demoOrder?.city ?? liveOrder!.city}
            <br />
            {demoOrder?.deliveryPhone ?? liveOrder!.delivery_phone}
          </p>
        </section>
        <section className="rounded-xl border border-zinc-200 p-5">
          <h2 className="text-lg font-bold text-zinc-900">Payment</h2>
          <div className="mt-2">
            {paymentStatus && (
              <PaymentStatusCard
                orderNumber={orderNumber}
                paymentMethod={paymentMethod}
                paymentStatus={paymentStatus}
                transactionId={txnOnFile}
                receiptFileName={receiptName}
                submittedAt={submittedAt}
                reviewNote={livePayment?.review_note ?? null}
                methodLabel={methodLabel}
              />
            )}
          </div>
          {demoOrder?.paymentSubmission?.receiptPreviewNote && (
            <p className="mt-3 text-xs text-zinc-500">
              {demoOrder.paymentSubmission.receiptPreviewNote}
            </p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-zinc-200 p-5">
        <h2 className="text-lg font-bold text-zinc-900">Items</h2>
        <ul className="mt-3 space-y-3">
          {demoOrder?.items.map((item) => (
            <li key={item.sku} className="flex gap-3 text-sm">
              <img src={item.image} alt="" className="h-14 w-12 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-900">{item.productName}</p>
                <p className="text-xs text-zinc-500">
                  {item.variantLabel} · SKU {item.sku} × {item.quantity}
                </p>
              </div>
              <span className="font-semibold whitespace-nowrap">{formatPKR(item.lineTotal)}</span>
            </li>
          ))}
          {liveOrder?.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="text-zinc-700">
                {item.product_name} ({item.variant_label}) × {item.quantity}
                <span className="block text-xs text-zinc-500">SKU {item.sku}</span>
              </span>
              <span className="font-semibold whitespace-nowrap">{formatPKR(item.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-zinc-200 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-600">Subtotal</dt>
            <dd className="font-semibold">{formatPKR(demoOrder?.subtotal ?? liveOrder!.subtotal)}</dd>
          </div>
          {(demoOrder?.discountAmount ?? liveOrder!.discount_amount) > 0 && (
            <div className="flex justify-between text-emerald-700">
              <dt>Discount</dt>
              <dd className="font-semibold">− {formatPKR(demoOrder?.discountAmount ?? liveOrder!.discount_amount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-zinc-600">Delivery</dt>
            <dd className="font-semibold">
              {(demoOrder?.deliveryCharges ?? liveOrder!.delivery_charges) === 0
                ? "Free"
                : formatPKR(demoOrder?.deliveryCharges ?? liveOrder!.delivery_charges)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-base">
            <dt className="font-bold">Total</dt>
            <dd className="font-extrabold text-[#0f2440]">{formatPKR(demoOrder?.totalAmount ?? liveOrder!.total_amount)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 p-5">
        <h2 className="text-lg font-bold text-zinc-900">Order Progress</h2>
        <div className="mt-4">
          <OrderTimeline status={status} />
        </div>
      </section>
    </main>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <p className="text-zinc-600">Loading your order…</p>
        </main>
      }
    >
      <OrderDetailContent />
    </Suspense>
  );
}
