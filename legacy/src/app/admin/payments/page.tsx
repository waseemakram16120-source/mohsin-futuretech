/**
 * /admin/payments — payment approval & verification (PDF §6).
 *
 * Lists wallet submissions (EasyPaisa / JazzCash / NayaPay — Transaction ID, receipt, order,
 * customer) with Approve / Reject (reason required) and the COD list
 * with Mark Paid. Live via API, demo via local orders.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminGet, adminSend } from "@/lib/admin-client";
import {
  adminUpdateDemoPayment,
  getDemoAdminPayments,
  getDemoCodPayments,
} from "@/lib/admin-data";
import type { AdminPayment } from "@/lib/admin-types";
import { formatPKR } from "@/lib/constants";
import {
  EmptyState,
  LoadingState,
  PageTitle,
  PaymentStatusBadge,
} from "@/components/admin-ui";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [codPayments, setCodPayments] = useState<AdminPayment[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    adminGet("/api/admin/payments")
      .then((json) => {
        if (json.mode === "live" && Array.isArray(json.payments)) {
          const all = json.payments as AdminPayment[];
          setPayments(all.filter((p) => p.paymentMethod !== "cod"));
          setCodPayments(all.filter((p) => p.paymentMethod === "cod"));
        } else {
          setPayments(getDemoAdminPayments());
          setCodPayments(getDemoCodPayments());
        }
      })
      .catch(() => {
        setPayments(getDemoAdminPayments());
        setCodPayments(getDemoCodPayments());
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function review(
    payment: AdminPayment,
    action: "approve" | "reject" | "mark-paid",
  ) {
    const note = (notes[payment.id] ?? "").trim();
    if (action === "reject" && !note) {
      setMessage("Please add a reason for rejecting this payment.");
      return;
    }
    setBusy(payment.id);
    setMessage(null);
    try {
      const json = await adminSend(
        `/api/admin/payments/${payment.id}`,
        "PATCH",
        { action, note },
      );
      if (json.mode === "demo") {
        const status =
          action === "approve" ? "approved" : action === "reject" ? "rejected" : "paid";
        adminUpdateDemoPayment(payment.orderNumber, { status, note: note || null });
      }
      setMessage(
        action === "approve"
          ? `Payment for ${payment.orderNumber} approved. The order can now proceed.`
          : action === "reject"
            ? `Payment for ${payment.orderNumber} rejected. The customer can submit corrected evidence.`
            : `Payment for ${payment.orderNumber} marked as Paid.`,
      );
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update the payment.");
    } finally {
      setBusy(null);
    }
  }

  if (!payments || !codPayments) return <LoadingState label="Loading payments…" />;

  const pending = payments.filter((p) => p.status === "pending_verification");

  return (
    <div>
      <PageTitle
        title="Payments"
        subtitle={`${pending.length} submission(s) pending verification`}
      />

      {message && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <h2 className="mb-2 font-semibold text-[#0f2440]">
        EasyPaisa / JazzCash / NayaPay submissions
      </h2>
      {payments.length === 0 ? (
        <EmptyState message="No wallet payments yet. When a customer submits Transaction ID + screenshot, it appears here as Pending Verification." />
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <article key={p.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/admin/orders/${p.orderId}`} className="font-semibold text-sky-700">
                    {p.orderNumber}
                  </Link>
                  <span className="ml-2 text-sm text-zinc-600">
                    {p.customerName} · {p.phone} · {formatPKR(p.amount)}
                  </span>
                  <span className="ml-2 text-xs capitalize text-zinc-500">
                    {p.paymentMethod}
                  </span>
                </div>
                <PaymentStatusBadge status={p.status} />
              </div>

              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex gap-4">
                  <dt className="w-32 shrink-0 text-zinc-500">Transaction ID</dt>
                  <dd className="font-mono">{p.transactionId ?? "—"}</dd>
                </div>
                <div className="flex gap-4">
                  <dt className="w-32 shrink-0 text-zinc-500">Receipt</dt>
                  <dd>
                    {p.receiptUrl ? (
                      <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                        View screenshot
                      </a>
                    ) : (
                      <span className="text-zinc-600">
                        {p.receiptFileName ?? "No receipt on file"}
                        {p.demo && p.receiptFileName
                          ? " (demo — file itself was not stored)"
                          : ""}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex gap-4">
                  <dt className="w-32 shrink-0 text-zinc-500">Submitted</dt>
                  <dd>{new Date(p.createdAt).toLocaleString("en-PK")}</dd>
                </div>
                {p.reviewNote && (
                  <div className="flex gap-4">
                    <dt className="w-32 shrink-0 text-zinc-500">Review note</dt>
                    <dd>{p.reviewNote}</dd>
                  </div>
                )}
              </dl>

              {p.status === "pending_verification" && (
                <div className="mt-3 flex flex-col gap-2 border-t pt-3">
                  <input
                    value={notes[p.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    placeholder="Review note (required if rejecting)…"
                    className="rounded border px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => void review(p, "approve")}
                      className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => void review(p, "reject")}
                      className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <h2 className="mb-2 mt-8 font-semibold text-[#0f2440]">
        Cash on Delivery
      </h2>
      {codPayments.length === 0 ? (
        <EmptyState message="No COD orders yet." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {codPayments.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${p.orderId}`} className="font-medium text-sky-700">
                      {p.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{p.customerName}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPKR(p.amount)}</td>
                  <td className="px-4 py-3">
                    <PaymentStatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    {p.status === "due" && (
                      <button
                        type="button"
                        disabled={busy === p.id}
                        onClick={() => void review(p, "mark-paid")}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
