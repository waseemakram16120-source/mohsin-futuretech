/**
 * Payment status card (Step 4).
 *
 * Shows the payment status with the exact labels from the proposal (§6):
 * Pending Verification / Approved / Rejected / COD — Due / Paid.
 * For wallet payments with no evidence yet it links to the
 * payment-submission page; for a rejected payment it invites resubmission.
 */
import Link from "next/link";
import { PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { canSubmitPayment } from "@/lib/payments";
import type { PaymentMethod, PaymentStatus } from "@/lib/types";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  pending_verification: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  due: "bg-zinc-100 text-zinc-700 border-zinc-200",
  paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export default function PaymentStatusCard({
  orderNumber,
  paymentMethod,
  paymentStatus,
  transactionId,
  receiptFileName,
  submittedAt,
  reviewNote,
  methodLabel,
}: {
  orderNumber: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId?: string | null;
  receiptFileName?: string | null;
  submittedAt?: string | null;
  reviewNote?: string | null;
  methodLabel: string;
}) {
  const check = canSubmitPayment({
    paymentMethod,
    paymentStatus,
    transactionId,
  });
  const submitted =
    transactionId !== null && transactionId !== undefined && transactionId.trim() !== "";

  return (
    <div className={`rounded-lg border p-4 text-sm ${STATUS_STYLES[paymentStatus]}`}>
      <p className="font-bold">
        {methodLabel} — {PAYMENT_STATUS_LABELS[paymentStatus]}
      </p>

      {paymentMethod === "cod" && paymentStatus === "due" && (
        <p className="mt-1">
          Cash payment expected at delivery. Please keep the exact amount
          ready when your order arrives.
        </p>
      )}
      {paymentMethod === "cod" && paymentStatus === "paid" && (
        <p className="mt-1">
          Cash payment received on delivery. Thank you!
        </p>
      )}

      {paymentMethod !== "cod" && paymentStatus === "pending_verification" && submitted && (
        <p className="mt-1">
          Your payment evidence is submitted and awaiting admin review. The
          store will approve it once verified — no further action needed
          right now.
        </p>
      )}
      {paymentMethod !== "cod" && paymentStatus === "pending_verification" && !submitted && (
        <p className="mt-1">
          Payment evidence not submitted yet. Please pay via {methodLabel} and
          submit your Transaction ID and receipt screenshot.
        </p>
      )}
      {paymentStatus === "approved" && paymentMethod !== "cod" && (
        <p className="mt-1">
          Your payment has been verified by the store. Your order can now
          proceed.
        </p>
      )}
      {paymentStatus === "rejected" && (
        <p className="mt-1">
          Your payment evidence was rejected by the store. Please check the
          reason below and submit correct evidence again.
        </p>
      )}

      {submitted && (
        <dl className="mt-2 space-y-1 border-t border-current/20 pt-2">
          <div className="flex justify-between gap-3">
            <dt className="opacity-70">Transaction ID</dt>
            <dd className="font-bold">{transactionId}</dd>
          </div>
          {receiptFileName && (
            <div className="flex justify-between gap-3">
              <dt className="opacity-70">Receipt</dt>
              <dd className="font-semibold">{receiptFileName}</dd>
            </div>
          )}
          {submittedAt && (
            <div className="flex justify-between gap-3">
              <dt className="opacity-70">Submitted</dt>
              <dd className="font-semibold">
                {new Date(submittedAt).toLocaleString("en-PK", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </dd>
            </div>
          )}
        </dl>
      )}

      {reviewNote && (
        <p className="mt-2 rounded bg-white/60 px-2 py-1">
          <strong>Store note:</strong> {reviewNote}
        </p>
      )}

      {check.allowed && (
        <Link
          href={`/pay/${encodeURIComponent(orderNumber)}`}
          className="mt-3 inline-block rounded-full bg-[#0f2440] px-5 py-2 text-sm font-bold text-white hover:bg-[#1a3a5c]"
        >
          {paymentStatus === "rejected"
            ? "Submit Correct Payment Evidence"
            : "Submit Payment Evidence"}
        </Link>
      )}
    </div>
  );
}
