/**
 * Payment attempt state machine. Mirrors public.payment_attempt_can_transition()
 * (tests/db/payment-gateway + tests/unit/payments keep them in sync).
 */
export const ATTEMPT_STATUSES = ["created", "pending", "processing", "paid", "failed", "cancelled", "expired"] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const ATTEMPT_TRANSITIONS: Record<AttemptStatus, readonly AttemptStatus[]> = {
  created: ["pending", "processing", "paid", "failed", "cancelled", "expired"],
  pending: ["processing", "paid", "failed", "cancelled", "expired"],
  processing: ["paid", "failed", "cancelled", "expired"],
  paid: [],
  // A provider-verified success after these still means money was taken.
  failed: ["paid"],
  cancelled: ["paid"],
  expired: ["paid"],
};

export function canTransition(from: AttemptStatus, to: AttemptStatus): boolean {
  return ATTEMPT_TRANSITIONS[from].includes(to);
}

/** Results a verified provider message may report. */
export const PROVIDER_RESULTS = ["pending", "processing", "paid", "failed", "cancelled", "expired"] as const;
export type ProviderResult = (typeof PROVIDER_RESULTS)[number];

/** Customer-facing copy (payment spec §17). Never shows provider internals. */
export const ATTEMPT_MESSAGES: Record<AttemptStatus, string> = {
  created: "Your payment has not been started yet.",
  pending: "Payment is being processed. Please do not retry yet.",
  processing: "Payment is being processed. Please do not retry yet.",
  paid: "Payment confirmed.",
  failed: "Payment could not be completed. You can try again.",
  cancelled: "Payment was cancelled. You can try again.",
  expired: "The payment window expired. You can try again.",
};
