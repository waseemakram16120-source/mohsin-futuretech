"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { changeOrderStatus, reviewPayment, type AdminResult } from "@/app/admin/actions";
import { FormMessage, inputClasses } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS, type OrderStatus } from "@/lib/domain";

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirm order",
  processing: "Start processing",
  shipped: "Mark as shipped",
  delivered: "Mark as delivered",
  cancelled: "Cancel order",
  returned: "Mark as returned",
};

/** Next-step buttons for the order (proposal §7), with an optional note. */
export function OrderStatusControl({
  orderId,
  status,
  walletUnverified,
}: {
  orderId: string;
  status: OrderStatus;
  /** JazzCash/Easypaisa order whose payment is not approved yet. */
  walletUnverified: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [note, setNote] = useState("");
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();
  const next = ORDER_TRANSITIONS[status];

  if (next.length === 0) {
    return (
      <p className="text-sm text-ink-soft" data-testid="status-control">
        This order is {ORDER_STATUS_LABELS[status].toLowerCase()}. No further status changes.
      </p>
    );
  }

  const run = (to: OrderStatus) => {
    if ((to === "cancelled" || to === "returned") && !window.confirm(`${ACTION_LABEL[to]}? Stock for its items will be added back.`)) return;
    start(async () => {
      const r = await changeOrderStatus({ orderId, to, note });
      setResult(r);
      if (r.ok) {
        setNote("");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4" data-testid="status-control">
      {result ? <FormMessage tone={result.ok ? "success" : "error"} testId="status-message">{result.message}</FormMessage> : null}
      <div>
        <label htmlFor={`${id}-note`} className="text-sm font-medium">
          Note <span className="font-normal text-muted">(optional, saved in the history)</span>
        </label>
        <input id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Courier: TCS, tracking 123456" className={cn(inputClasses(false), "mt-1.5")} />
      </div>
      <div className="flex flex-wrap gap-2">
        {next.map((to) => {
          const blocked = to === "confirmed" && walletUnverified;
          const danger = to === "cancelled" || to === "returned";
          return (
            <Button key={to} variant={danger ? "secondary" : "primary"} disabled={pending || blocked} onClick={() => run(to)} className={danger ? "border-sale text-sale hover:bg-sale hover:text-surface" : undefined}>
              {ACTION_LABEL[to]}
            </Button>
          );
        })}
      </div>
      {next.includes("confirmed") && walletUnverified ? (
        <p className="text-xs text-ink-soft">Confirm is available after the customer&rsquo;s payment is approved.</p>
      ) : null}
    </div>
  );
}

/** Approve / reject (with reason) / mark paid for the order's current payment record. */
export function PaymentReviewControl({ paymentId, canApprove, canMarkPaid }: { paymentId: string; canApprove: boolean; canMarkPaid: boolean }) {
  const router = useRouter();
  const id = useId();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();

  const run = (action: "approve" | "reject" | "mark_paid") =>
    start(async () => {
      const r = await reviewPayment({ paymentId, action, note: action === "reject" ? reason : "" });
      setResult(r);
      if (r.ok) {
        setRejecting(false);
        setReason("");
        router.refresh();
      }
    });

  if (!canApprove && !canMarkPaid) return result ? <FormMessage tone={result.ok ? "success" : "error"} testId="review-message">{result.message}</FormMessage> : null;

  return (
    <div className="space-y-3" data-testid="payment-review">
      {result ? <FormMessage tone={result.ok ? "success" : "error"} testId="review-message">{result.message}</FormMessage> : null}
      {canApprove ? (
        rejecting ? (
          <div className="space-y-3 rounded-card border border-stone p-4">
            <label htmlFor={`${id}-reason`} className="text-sm font-medium">
              Reason for rejecting (shown to the customer)
            </label>
            <textarea
              id={`${id}-reason`}
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The amount on the receipt does not match the order total."
              className={cn(inputClasses(false), "h-auto py-3")}
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending || reason.trim().length < 3} onClick={() => run("reject")} className="bg-sale hover:bg-sale/90">
                Reject payment
              </Button>
              <Button variant="ghost" onClick={() => setRejecting(false)} disabled={pending}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => run("approve")}>
              Approve payment
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setRejecting(true)} className="border-sale text-sale hover:bg-sale hover:text-surface">
              Reject…
            </Button>
          </div>
        )
      ) : null}
      {canMarkPaid ? (
        <Button
          disabled={pending}
          onClick={() => {
            if (window.confirm("Mark this payment as received?")) run("mark_paid");
          }}
        >
          Mark as paid
        </Button>
      ) : null}
    </div>
  );
}
