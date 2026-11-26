/**
 * Submit payment evidence (Step 4) — /pay/[orderNumber].
 *
 * For wallet orders (EasyPaisa / JazzCash / NayaPay): shows the payment instructions and a
 * form for the Transaction ID + receipt screenshot. The submission goes
 * to POST /api/payments (validated server-side). COD orders see no form —
 * they pay cash on delivery.
 *
 * Order resolution: demo orders from localStorage; live orders via
 * GET /api/orders (signed-in owner, or order number + delivery phone).
 */
"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatPKR } from "@/lib/constants";
import {
  RECEIPT_ACCEPT,
  canSubmitPayment,
  validateReceiptFile,
  validateTransactionId,
} from "@/lib/payments";
import {
  findDemoOrder,
  saveDemoPaymentSubmission,
  type DemoOrder,
} from "@/lib/demo-orders";
import type { OrderWithDetails, PaymentMethod } from "@/lib/types";
import PaymentInstructions from "@/components/PaymentInstructions";
import PaymentStatusCard from "@/components/PaymentStatusCard";

function PayContent() {
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = decodeURIComponent(params.orderNumber ?? "").toUpperCase();

  const [demoOrder, setDemoOrder] = useState<DemoOrder | null>(null);
  const [liveOrder, setLiveOrder] = useState<OrderWithDetails | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const [transactionId, setTransactionId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ txn?: string; file?: string }>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolveLive = useCallback(
    async (phoneToUse: string) => {
      const query = phoneToUse
        ? `/api/orders?number=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phoneToUse)}`
        : `/api/orders?number=${encodeURIComponent(orderNumber)}`;
      const response = await fetch(query);
      const result = await response.json();
      if (response.ok && result?.found) {
        setLiveOrder(result.order as OrderWithDetails);
        return true;
      }
      return false;
    },
    [orderNumber],
  );

  const resolveOrder = useCallback(
    async (phoneToUse = "") => {
      const demo = findDemoOrder(orderNumber);
      if (demo) {
        setDemoOrder(demo);
        setPhone(demo.deliveryPhone);
        setLoaded(true);
        return;
      }
      try {
        const found = await resolveLive(phoneToUse);
        if (found) {
          setNeedsPhone(false);
          setLoaded(true);
          return;
        }
      } catch {
        // Fall through to the phone prompt / not-found state.
      }
      setNeedsPhone(true);
      setLoaded(true);
    },
    [orderNumber, resolveLive],
  );

  useEffect(() => {
    void resolveOrder();
  }, [resolveOrder]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function onPhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError("");
    if (phone.trim().length < 10) {
      setPhoneError("Enter the phone number you used when placing the order.");
      return;
    }
    setLookingUp(true);
    try {
      const found = await resolveLive(phone.trim());
      if (found) {
        setNeedsPhone(false);
      } else {
        // Demo orders are checked first; a live lookup failing here means
        // the number/phone pair does not match any order.
        setNotFound(true);
      }
    } catch {
      setPhoneError("Could not look up your order. Please try again.");
    } finally {
      setLookingUp(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    if (!chosen) return;
    const error = validateReceiptFile(chosen);
    if (error) {
      setFieldErrors((prev) => ({ ...prev, file: error }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, file: undefined }));
    setFile(chosen);
    setPreviewUrl(URL.createObjectURL(chosen));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    const nextErrors: { txn?: string; file?: string } = {};
    const txnError = validateTransactionId(transactionId);
    if (txnError) nextErrors.txn = txnError;
    if (!file) {
      nextErrors.file = "Please upload a screenshot of your payment receipt.";
    } else {
      const fileError = validateReceiptFile(file);
      if (fileError) nextErrors.file = fileError;
    }
    setFieldErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("orderNumber", orderNumber);
      form.append("transactionId", transactionId.trim());
      form.append("note", note.trim());
      form.append("phone", phone);
      form.append("paymentMethod", paymentMethod);
      form.append("receipt", file!);
      const response = await fetch("/api/payments", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) {
        setSubmitError(result?.error ?? "Could not submit your payment. Please try again.");
        return;
      }
      if (result?.mode === "demo") {
        const updated = saveDemoPaymentSubmission(orderNumber, {
          transactionId: transactionId.trim(),
          receiptFileName: file!.name,
          note: note.trim() || null,
        });
        if (updated) setDemoOrder(updated);
      } else {
        // Live mode — re-read the order so the status card shows the
        // submitted evidence.
        await resolveLive(phone);
      }
      setJustSubmitted(true);
      setFile(null);
      setTransactionId("");
      setNote("");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setSubmitError("Could not submit your payment. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-zinc-600">Loading your order…</p>
      </main>
    );
  }

  if (notFound || (!demoOrder && !liveOrder && !needsPhone)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-zinc-900">Order not found</h1>
        <p className="mt-2 text-zinc-600">
          We could not find order {orderNumber}. Check the order number and
          try again.
        </p>
        <Link href="/track" className="mt-6 inline-block rounded-full bg-[#0f2440] px-6 py-3 text-sm font-bold text-white">
          Track an Order
        </Link>
      </main>
    );
  }

  // Live orders need the delivery phone to prove ownership (guests).
  if (needsPhone && !demoOrder && !liveOrder) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-zinc-900">Submit Payment — {orderNumber}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Enter the phone number you used at checkout to open this order.
        </p>
        <form onSubmit={onPhoneSubmit} className="mt-6 space-y-4 rounded-xl border border-zinc-200 p-5">
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
            {phoneError && <p className="mt-1 text-xs font-semibold text-red-600">{phoneError}</p>}
          </div>
          <button
            type="submit"
            disabled={lookingUp}
            className="rounded-full bg-[#0f2440] px-8 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c] disabled:bg-zinc-300"
          >
            {lookingUp ? "Looking up…" : "Continue"}
          </button>
        </form>
      </main>
    );
  }

  const paymentMethod = (demoOrder?.paymentMethod ?? liveOrder!.payment_method) as PaymentMethod;
  const total = demoOrder?.totalAmount ?? liveOrder!.total_amount;
  const methodLabel =
    paymentMethod === "easypaisa"
      ? "EasyPaisa"
      : paymentMethod === "jazzcash"
        ? "JazzCash"
        : paymentMethod === "nayapay"
          ? "NayaPay"
          : "Cash on Delivery";

  const livePayment = liveOrder?.payments?.[0];
  const paymentStatus = demoOrder?.paymentStatus ?? livePayment?.status ?? "pending_verification";
  const txnOnFile = demoOrder?.paymentSubmission?.transactionId ?? livePayment?.transaction_id ?? null;
  const receiptName =
    demoOrder?.paymentSubmission?.receiptFileName ??
    (livePayment?.receipt_url ? livePayment.receipt_url.split("/").pop() ?? null : null);
  const submittedAt = demoOrder?.paymentSubmission?.submittedAt ?? livePayment?.created_at ?? null;
  const reviewNote = livePayment?.review_note ?? null;

  const check = canSubmitPayment({
    paymentMethod,
    paymentStatus,
    transactionId: txnOnFile,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/track" className="text-sm font-semibold text-[#0f2440] hover:underline">
        ← Back to Track Order
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-zinc-900">Submit Payment — {orderNumber}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {methodLabel} · Total {formatPKR(total)}
        {demoOrder ? " · Demo order (saved in this browser)" : ""}
      </p>

      {justSubmitted && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          ✓ Payment evidence submitted. It is now Pending Verification — the
          store will review it and approve it once verified. Your order will
          be confirmed after approval.
        </p>
      )}

      <div className="mt-6 space-y-6">
        <PaymentStatusCard
          orderNumber={orderNumber}
          paymentMethod={paymentMethod}
          paymentStatus={paymentStatus}
          transactionId={txnOnFile}
          receiptFileName={receiptName}
          submittedAt={submittedAt}
          reviewNote={reviewNote}
          methodLabel={methodLabel}
        />

        {paymentMethod !== "cod" && (
          <PaymentInstructions method={paymentMethod} amount={total} orderNumber={orderNumber} />
        )}

        {paymentMethod !== "cod" && check.allowed && (
          <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-zinc-200 p-5" noValidate>
            <h2 className="text-lg font-bold text-zinc-900">Submit Payment Evidence</h2>

            <div>
              <label htmlFor="txn" className="text-sm font-semibold text-zinc-900">
                Transaction ID *
              </label>
              <input
                id="txn"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-[#0f2440]"
                placeholder="e.g. 1234567890"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-zinc-500">
                The Transaction ID from your {methodLabel} app / SMS receipt.
              </p>
              {fieldErrors.txn && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.txn}</p>}
            </div>

            <div>
              <label htmlFor="receipt" className="text-sm font-semibold text-zinc-900">
                Payment screenshot / receipt *
              </label>
              <input
                ref={fileInputRef}
                id="receipt"
                type="file"
                accept={RECEIPT_ACCEPT}
                onChange={onFileChange}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#0f2440] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
              />
              <p className="mt-1 text-xs text-zinc-500">
                JPG, PNG or WebP, 5 MB or smaller.
              </p>
              {fieldErrors.file && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.file}</p>}
              {previewUrl && file && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-zinc-700">
                    Preview — {file.name} ({(file.size / 1024).toFixed(0)} KB)
                  </p>
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    className="mt-2 max-h-64 rounded-lg border border-zinc-200 object-contain"
                  />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="pay-note" className="text-sm font-semibold text-zinc-900">
                Note (optional)
              </label>
              <input
                id="pay-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-[#0f2440]"
                placeholder="Anything the store should know about this payment?"
              />
            </div>

            {submitError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#0f2440] px-8 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c] disabled:bg-zinc-300"
            >
              {submitting ? "Submitting…" : "Submit Payment Evidence"}
            </button>
            <p className="text-xs text-zinc-500">
              Manual verification only — no automatic payment gateway. Your
              payment stays Pending Verification until the store approves it.
            </p>
          </form>
        )}

        {paymentMethod !== "cod" && !check.allowed && !justSubmitted && (
          <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">{check.reason}</p>
        )}
      </div>
    </main>
  );
}

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <p className="text-zinc-600">Loading your order…</p>
        </main>
      }
    >
      <PayContent />
    </Suspense>
  );
}
