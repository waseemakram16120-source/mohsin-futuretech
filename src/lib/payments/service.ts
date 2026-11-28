import "server-only";

import { isGatewayMethod } from "@/config/store";
import { ordersPlacedHere } from "@/lib/orders/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { secureReference } from "./crypto";
import { logPayment } from "./log";
import { providerById, providerFor } from "./registry";
import type { InitiationAction } from "./providers/types";

export interface PayableOrder {
  id: string;
  order_number: string;
  user_id: string | null;
  payment_method: string;
  delivery_phone: string;
  customer_email: string | null;
}

async function loadOrder(orderNumber: string): Promise<PayableOrder | null> {
  const { data, error } = await createAdminClient()
    .from("orders")
    .select("id, order_number, user_id, payment_method, delivery_phone, customer_email")
    .eq("order_number", orderNumber.toUpperCase())
    .maybeSingle();
  if (error) throw new Error("Could not load order", { cause: error });
  return (data as PayableOrder | null) ?? null;
}

/**
 * Authorisation (no IDOR): the browser that placed the order (signed
 * cookie) or the signed-in owner. Unknown and foreign orders look the same.
 */
export async function authorisedOrder(orderNumber: string): Promise<PayableOrder | null> {
  if (!/^MF-\d{6}-\d{5,}$/i.test(orderNumber)) return null;
  const order = await loadOrder(orderNumber);
  if (!order) return null;
  if ((await ordersPlacedHere()).includes(order.order_number)) return order;
  if (order.user_id) {
    try {
      const { data } = await (await createClient()).auth.getUser();
      if (data.user?.id === order.user_id) return order;
    } catch {
      // not signed in
    }
  }
  return null;
}

const START_ERRORS: Record<string, { status: number; message: string }> = {
  already_paid: { status: 409, message: "This order is already paid." },
  evidence_under_review: {
    status: 409,
    message: "We already have your payment details for this order and our team is reviewing them. Please don't pay again.",
  },
  order_not_payable: { status: 409, message: "This order can no longer be paid online. Please contact us." },
  cod_order: { status: 409, message: "This order is Cash on Delivery." },
  provider_mismatch: { status: 409, message: "This payment method does not match your order." },
  payment_in_progress: {
    status: 409,
    message: "A payment for this order is already being processed. Please do not retry yet — we'll update your order as soon as it is confirmed.",
  },
};

export type InitiateResult =
  | { ok: true; action: InitiationAction; reference: string; testGateway: boolean }
  | { ok: false; status: number; message: string };

/** Server-side initiation (payment spec §7). The amount comes from the order. */
export async function initiatePayment(orderNumber: string): Promise<InitiateResult> {
  const order = await authorisedOrder(orderNumber);
  if (!order) return { ok: false, status: 404, message: "Order not found." };
  if (!isGatewayMethod(order.payment_method)) return { ok: false, status: 409, message: START_ERRORS.cod_order.message };

  const provider = providerFor(order.payment_method);
  if (!provider) {
    return { ok: false, status: 503, message: "Online payment is temporarily unavailable. Please contact us to complete your order." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("start_payment_attempt", {
    p_order_id: order.id,
    p_provider: provider.id,
    p_reference: secureReference(20),
    p_ttl_minutes: 30,
  });
  if (error) {
    const known = START_ERRORS[error.message];
    logPayment(known ? "info" : "error", { event: "initiate_refused", provider: provider.id, orderNumber: order.order_number, reason: known ? error.message : "db_error" });
    return known ? { ok: false, ...known } : { ok: false, status: 500, message: "We couldn't start the payment. Please try again." };
  }
  const attempt = data as { reference: string; amount_minor: number; currency: "PKR"; expires_at: string; reused: boolean };

  let action: InitiationAction;
  try {
    action = await provider.initiate({
      reference: attempt.reference,
      amountMinor: Number(attempt.amount_minor),
      currency: attempt.currency,
      orderNumber: order.order_number,
      expiresAt: attempt.expires_at,
      customer: { phone: order.delivery_phone, email: order.customer_email },
    });
  } catch (err) {
    logPayment("error", { event: "initiate_failed", provider: provider.id, reference: attempt.reference, reason: (err as Error).name });
    return { ok: false, status: 502, message: "We couldn't reach the payment provider. Please try again in a moment." };
  }

  // The customer is now being handed to the provider: created → pending.
  await admin.rpc("apply_payment_event", {
    p_provider: provider.id,
    p_reference: attempt.reference,
    p_event_type: "initiate",
    p_dedupe_key: `init:${provider.id}:${attempt.reference}`,
    p_verified: true,
    p_result: "pending",
    p_details: { reused: attempt.reused },
  });
  logPayment("info", { event: "initiated", provider: provider.id, reference: attempt.reference, orderNumber: order.order_number, reused: attempt.reused, amountMinor: Number(attempt.amount_minor) });
  return { ok: true, action, reference: attempt.reference, testGateway: provider.id === "test" };
}

/**
 * Callback / return handling (payment spec §8): verify with the provider
 * adapter, then apply idempotently in the database. Returns the order
 * number for the browser redirect (looked up from OUR data, never from the
 * request), or null.
 */
export async function handleCallback(providerId: string, method: string, params: Record<string, string>) {
  const provider = providerById(providerId);
  if (!provider) return { orderNumber: null, outcome: "rejected" as const };

  const verification = await provider.verifyCallback({ method, params });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("apply_payment_event", verification.verified
    ? {
        p_provider: provider.id,
        p_reference: verification.reference,
        p_event_type: method === "GET" ? "return" : "callback",
        p_dedupe_key: verification.dedupeKey,
        p_verified: true,
        p_result: verification.result,
        p_provider_txn_id: verification.providerTxnId,
        p_amount_minor: verification.amountMinor,
        p_currency: verification.currency,
        p_details: verification.summary,
      }
    : {
        p_provider: provider.id,
        p_reference: verification.reference ?? "unknown",
        p_event_type: method === "GET" ? "return" : "callback",
        p_dedupe_key: verification.dedupeKey,
        p_verified: false,
        p_result: "failed",
        p_reason: verification.reason,
      });
  if (error) {
    logPayment("error", { event: "callback_db_error", provider: provider.id, reference: verification.reference ?? "unknown" });
    throw new Error("Payment callback could not be recorded");
  }
  const r = data as { outcome: string; status: string | null; reason: string | null };
  logPayment(r.outcome === "rejected" ? "warn" : "info", {
    event: "callback",
    provider: provider.id,
    reference: verification.reference ?? "unknown",
    outcome: r.outcome,
    reason: r.reason ?? (verification.verified ? null : verification.reason),
    status: r.status,
  });

  let orderNumber: string | null = null;
  if (verification.reference) {
    const { data: row } = await admin
      .from("payment_attempts")
      .select("order:orders(order_number)")
      .eq("reference", verification.reference)
      .eq("provider", provider.id)
      .maybeSingle();
    orderNumber = (row as { order?: { order_number?: string } } | null)?.order?.order_number ?? null;
  }
  return { orderNumber, outcome: r.outcome };
}

export interface PaymentState {
  order_number: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  total_minor: number;
  latest_attempt: null | {
    reference: string;
    provider: string;
    status: string;
    failure_message: string | null;
    expires_at: string;
    verified_at: string | null;
  };
}

export async function paymentState(orderNumber: string): Promise<PaymentState | null> {
  const order = await authorisedOrder(orderNumber);
  if (!order) return null;
  const { data, error } = await createAdminClient().rpc("order_payment_state", { p_order_id: order.id });
  if (error) throw new Error("Could not load payment state", { cause: error });
  return data as PaymentState;
}
