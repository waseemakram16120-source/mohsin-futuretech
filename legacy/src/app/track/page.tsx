/**
 * Order tracking (Step 3) — /track.
 *
 * Enter an order number and the delivery phone number. Live orders are
 * looked up via GET /api/orders; demo orders (placed while Supabase was
 * not connected) are looked up in localStorage. Shows the full status
 * timeline from the proposal workflow.
 */
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPKR, PAYMENT_METHODS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { findDemoOrder, type DemoOrder } from "@/lib/demo-orders";
import type { OrderWithDetails } from "@/lib/types";
import OrderTimeline from "@/components/OrderTimeline";
import PaymentStatusCard from "@/components/PaymentStatusCard";

function TrackForm() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get("order") ?? "");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoOrder, setDemoOrder] = useState<DemoOrder | null>(null);
  const [liveOrder, setLiveOrder] = useState<OrderWithDetails | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const prefilled = searchParams.get("order");
    if (prefilled) setOrderNumber(prefilled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDemoOrder(null);
    setLiveOrder(null);
    const number = orderNumber.trim().toUpperCase();
    if (!number.startsWith("MF-")) {
      setError("Enter a valid order number, e.g. MF-20261124-00001.");
      return;
    }
    if (phone.trim().length < 10) {
      setError("Enter the phone number you used when placing the order.");
      return;
    }
    setBusy(true);
    setSearched(true);
    try {
      const response = await fetch(
        `/api/orders?number=${encodeURIComponent(number)}&phone=${encodeURIComponent(phone.trim())}`,
      );
      const result = await response.json();
      if (response.ok && result?.found) {
        setLiveOrder(result.order as OrderWithDetails);
      } else {
        // Demo fallback — orders placed while Supabase was not connected.
        const demo = findDemoOrder(number);
        if (demo) {
          const digits = (s: string) => s.replace(/[^\d]/g, "").replace(/^92/, "0");
          if (digits(demo.deliveryPhone) === digits(phone.trim())) {
            setDemoOrder(demo);
          } else {
            setError("No order found for this order number and phone number.");
          }
        } else {
          setError(result?.error ?? "No order found for this order number and phone number.");
        }
      }
    } catch {
      setError("Could not look up your order. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const order = demoOrder ?? liveOrder;
  const status = demoOrder?.status ?? liveOrder?.status;
  const paymentMethod = demoOrder?.paymentMethod ?? liveOrder?.payment_method;
  const paymentStatus = demoOrder?.paymentStatus ?? liveOrder?.payments?.[0]?.status;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Track Your Order</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Enter your order number and the phone number you used at checkout.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border border-zinc-200 p-5">
        <div>
          <label htmlFor="order-number" className="text-sm font-semibold text-zinc-900">
            Order number *
          </label>
          <input
            id="order-number"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-[#0f2440]"
            placeholder="MF-20261124-00001"
          />
        </div>
        <div>
          <label htmlFor="phone" className="text-sm font-semibold text-zinc-900">
            Phone number *
          </label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-[#0f2440]"
            placeholder="0300 1234567"
            inputMode="tel"
          />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[#0f2440] px-8 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c] disabled:bg-zinc-300"
        >
          {busy ? "Looking up…" : "Track Order"}
        </button>
      </form>

      {searched && !busy && !order && !error && (
        <p className="mt-6 text-sm text-zinc-500">No order found.</p>
      )}

      {order && status && (
        <section className="mt-6 rounded-xl border border-zinc-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">
                Order {demoOrder?.orderNumber ?? liveOrder!.order_number}
              </h2>
              <p className="text-sm text-zinc-500">
                {paymentMethod ? PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label : ""} ·{" "}
                {paymentStatus ? PAYMENT_STATUS_LABELS[paymentStatus] : ""} · Total{" "}
                {formatPKR(demoOrder?.totalAmount ?? liveOrder!.total_amount)}
                {demoOrder ? " · Demo order" : ""}
              </p>
            </div>
            <Link
              href={`/account/orders/${demoOrder?.orderNumber ?? liveOrder!.order_number}?phone=${encodeURIComponent(phone.trim())}`}
              className="text-sm font-semibold text-[#0f2440] hover:underline"
            >
              View full details →
            </Link>
          </div>
          <div className="mt-5">
            <OrderTimeline status={status} />
          </div>
          {paymentStatus && paymentMethod && (
            <div className="mt-5">
              <PaymentStatusCard
                orderNumber={demoOrder?.orderNumber ?? liveOrder!.order_number}
                paymentMethod={paymentMethod}
                paymentStatus={paymentStatus}
                transactionId={
                  demoOrder?.paymentSubmission?.transactionId ??
                  liveOrder?.payments?.[0]?.transaction_id ??
                  null
                }
                receiptFileName={
                  demoOrder?.paymentSubmission?.receiptFileName ??
                  (liveOrder?.payments?.[0]?.receipt_url
                    ? liveOrder.payments[0].receipt_url.split("/").pop() ?? null
                    : null)
                }
                submittedAt={
                  demoOrder?.paymentSubmission?.submittedAt ??
                  (liveOrder?.payments?.[0]?.transaction_id
                    ? liveOrder.payments[0].updated_at ?? null
                    : null)
                }
                reviewNote={liveOrder?.payments?.[0]?.review_note ?? null}
                methodLabel={
                  PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label ?? ""
                }
              />
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-16"><p className="text-zinc-600">Loading…</p></main>
      }
    >
      <TrackForm />
    </Suspense>
  );
}
