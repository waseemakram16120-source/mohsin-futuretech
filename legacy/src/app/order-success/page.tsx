/**
 * Order confirmation (Step 3).
 *
 * Shown after a successful checkout. Reads the order back (live via the
 * API, demo via localStorage) and shows the order reference, items,
 * total, payment method and what happens next.
 */
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPKR, PAYMENT_METHODS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { findDemoOrder, type DemoOrder } from "@/lib/demo-orders";
import type { OrderWithDetails } from "@/lib/types";
import PaymentInstructions from "@/components/PaymentInstructions";
import PaymentStatusCard from "@/components/PaymentStatusCard";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order") ?? "";
  const mode = searchParams.get("mode") ?? "live";
  const [demoOrder, setDemoOrder] = useState<DemoOrder | null>(null);
  const [liveOrder, setLiveOrder] = useState<OrderWithDetails | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!orderNumber) {
      setLoaded(true);
      return;
    }
    if (mode === "demo") {
      setDemoOrder(findDemoOrder(orderNumber));
      setLoaded(true);
      return;
    }
    fetch(`/api/orders?number=${encodeURIComponent(orderNumber)}`)
      .then((r) => r.json())
      .then((result) => {
        if (result?.found) setLiveOrder(result.order as OrderWithDetails);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [orderNumber, mode]);

  const paymentMethod = demoOrder?.paymentMethod ?? liveOrder?.payment_method;
  const methodLabel = PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label ?? "—";
  const total = demoOrder?.totalAmount ?? liveOrder?.total_amount ?? null;
  const paymentStatus = demoOrder?.paymentStatus ?? liveOrder?.payments?.[0]?.status;
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
    <main className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
      <p className="text-5xl">✓</p>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900 sm:text-3xl">
        Thank you! Your order is placed.
      </h1>
      <p className="mt-2 text-zinc-600">
        Your order reference is{" "}
        <strong className="text-[#0f2440]">{orderNumber || "—"}</strong>. Keep it safe —
        you can use it to track your order.
      </p>

      {mode === "demo" && (
        <p className="mx-auto mt-4 max-w-xl rounded-lg bg-amber-50 px-3 py-2 text-left text-sm text-amber-800">
          Demo order — the store database is not connected yet, so this order is saved
          in your browser only. It will still appear in your order history and tracking
          on this device.
        </p>
      )}

      {loaded && total !== null && (
        <div className="mx-auto mt-6 max-w-xl rounded-xl border border-zinc-200 p-5 text-left">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-600">Order reference</dt>
              <dd className="font-bold text-zinc-900">{orderNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-600">Payment method</dt>
              <dd className="font-semibold text-zinc-900">{methodLabel}</dd>
            </div>
            {paymentStatus && (
              <div className="flex justify-between">
                <dt className="text-zinc-600">Payment status</dt>
                <dd className="font-semibold text-zinc-900">
                  {PAYMENT_STATUS_LABELS[paymentStatus]}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-zinc-200 pt-2">
              <dt className="font-bold text-zinc-900">Total</dt>
              <dd className="font-extrabold text-[#0f2440]">{formatPKR(total)}</dd>
            </div>
          </dl>

          {demoOrder && (
            <ul className="mt-4 space-y-2 border-t border-zinc-200 pt-4">
              {demoOrder.items.map((item) => (
                <li key={item.sku} className="flex justify-between gap-3 text-sm">
                  <span className="text-zinc-700">
                    {item.productName} ({item.variantLabel}) × {item.quantity}
                  </span>
                  <span className="font-semibold whitespace-nowrap">
                    {formatPKR(item.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {liveOrder && (
            <ul className="mt-4 space-y-2 border-t border-zinc-200 pt-4">
              {liveOrder.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-zinc-700">
                    {item.product_name} ({item.variant_label}) × {item.quantity}
                  </span>
                  <span className="font-semibold whitespace-nowrap">
                    {formatPKR(item.line_total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loaded && total !== null && paymentMethod && paymentMethod !== "cod" && (
        <div className="mx-auto mt-6 max-w-xl space-y-4 text-left">
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
          <PaymentInstructions method={paymentMethod} amount={total} orderNumber={orderNumber} />
        </div>
      )}

      <div className="mx-auto mt-6 max-w-xl rounded-xl bg-zinc-50 p-4 text-left text-sm leading-relaxed text-zinc-600">
        <p className="font-bold text-zinc-900">What happens next?</p>
        {paymentMethod === "cod" ? (
          <p className="mt-1">
            Our team will review your order and confirm it. Please keep the exact
            amount ready — you pay in cash when your order arrives.
          </p>
        ) : (
          <p className="mt-1">
            Please complete your {methodLabel} payment using the account
            instructions above, then{" "}
            <Link href={`/pay/${encodeURIComponent(orderNumber)}`} className="font-semibold text-[#0f2440] hover:underline">
              submit your Transaction ID and payment screenshot
            </Link>
            . Your payment will stay Pending Verification until the store
            approves it.
          </p>
        )}
        <p className="mt-1">
          You can check your order progress any time on the{" "}
          <Link href="/track" className="font-semibold text-[#0f2440] hover:underline">
            Track Order
          </Link>{" "}
          page.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href={`/track?order=${encodeURIComponent(orderNumber)}`}
          className="rounded-full bg-[#0f2440] px-6 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c]"
        >
          Track This Order
        </Link>
        <Link
          href="/shop"
          className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-bold text-zinc-700 hover:border-[#0f2440]"
        >
          Continue Shopping
        </Link>
      </div>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <p className="text-zinc-600">Loading your order…</p>
        </main>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
