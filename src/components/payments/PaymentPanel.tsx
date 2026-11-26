"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PAYMENT_METHOD_LABELS, type GatewayMethod } from "@/config/store";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { ATTEMPT_MESSAGES, type AttemptStatus } from "@/lib/payments/status";
import { startPayment } from "./perform-action";

export interface PanelState {
  paymentStatus: string;
  orderStatus: string;
  totalMinor: number;
  attempt: { status: AttemptStatus; failureMessage: string | null } | null;
}

const POLL_MS = 4000;
const POLL_LIMIT = 30; // ~2 minutes

/**
 * Online payment panel on the order page. The status shown always comes
 * from our server (database), never from the URL the provider returned to.
 */
export function PaymentPanel({
  orderNumber,
  method,
  initial,
  available,
  returned,
}: {
  orderNumber: string;
  method: GatewayMethod;
  initial: PanelState;
  available: boolean;
  returned: boolean;
}) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);
  const label = PAYMENT_METHOD_LABELS[method];
  const paid = state.paymentStatus === "paid";
  const inFlight = !paid && (state.attempt?.status === "pending" || state.attempt?.status === "processing");
  const closed = state.orderStatus === "cancelled" || state.orderStatus === "returned";

  useEffect(() => {
    if (!inFlight || polls >= POLL_LIMIT) return;
    const id = window.setTimeout(async () => {
      setPolls((n) => n + 1);
      try {
        const res = await fetch(`/api/payments/status?order=${encodeURIComponent(orderNumber)}`, { cache: "no-store" });
        if (!res.ok) return;
        const s = await res.json();
        setState({
          paymentStatus: s.payment_status,
          orderStatus: s.order_status,
          totalMinor: Number(s.total_minor),
          attempt: s.latest_attempt ? { status: s.latest_attempt.status, failureMessage: s.latest_attempt.failure_message } : null,
        });
      } catch {
        // keep the last known state; the next poll retries
      }
    }, POLL_MS);
    return () => window.clearTimeout(id);
  }, [inFlight, orderNumber, polls]);

  const pay = async () => {
    setBusy(true);
    setError(null);
    const r = await startPayment(orderNumber);
    if (!r.ok) {
      setError(r.message);
      setBusy(false);
    }
  };

  const amount = formatPrice(state.totalMinor / 100);
  let tone: "success" | "warning" | "neutral" | "danger" = "neutral";
  let message: string;
  if (paid) {
    tone = "success";
    message = `${ATTEMPT_MESSAGES.paid} We received ${amount} via ${label}.`;
  } else if (inFlight) {
    tone = "warning";
    message =
      polls >= POLL_LIMIT
        ? "We could not confirm your payment yet. Your order remains pending — please don't pay again. Contact us with your order number if this continues."
        : ATTEMPT_MESSAGES[state.attempt!.status];
  } else if (state.attempt && ["failed", "cancelled", "expired"].includes(state.attempt.status)) {
    tone = "danger";
    message = ATTEMPT_MESSAGES[state.attempt.status];
  } else {
    message = `Pay ${amount} securely on ${label}'s own payment page. We never ask for your PIN or OTP.`;
  }

  return (
    <div className="mt-4 space-y-4 text-sm" data-testid="payment-panel">
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-start gap-2 rounded-card p-4",
          tone === "success" && "bg-success-soft text-success",
          tone === "warning" && "bg-warning-soft text-warning",
          tone === "danger" && "bg-sale-soft text-sale",
          tone === "neutral" && "bg-accent-soft text-accent-strong",
        )}
        data-testid="payment-message"
      >
        <Icon name={paid ? "shield" : inFlight ? "refresh" : "wallet"} className="mt-0.5 size-4 shrink-0" />
        <span>{message}</span>
      </p>
      {returned && !paid && !inFlight && !state.attempt ? (
        <p className="text-ink-soft">We haven&rsquo;t received a payment confirmation for this order.</p>
      ) : null}

      {!paid && !inFlight && !closed ? (
        available ? (
          <Button size="lg" onClick={pay} disabled={busy} className="w-full sm:w-auto">
            {busy ? "Opening secure payment…" : `${state.attempt ? "Try again" : "Pay"} ${amount} with ${label}`}
          </Button>
        ) : (
          <p className="rounded-card border border-stone p-4 text-ink-soft">
            Online payment with {label} is temporarily unavailable. Please contact us on WhatsApp with your order number to complete your order.
          </p>
        )
      ) : null}
      {error ? (
        <p role="alert" className="text-sale">
          {error}
        </p>
      ) : null}
    </div>
  );
}
