/**
 * INTERNAL SANDBOX TEST GATEWAY — not JazzCash, not Easypaisa, no real money.
 *
 * Exists so the complete payment pipeline (attempt → hosted page → signed
 * callback → verification → idempotent status transition) can be exercised
 * end-to-end before the merchant documentation and sandbox credentials
 * arrive. Enabled only with PAYMENTS_TEST_GATEWAY=1 outside production
 * (enforced in config.ts and again here).
 *
 * Protocol (ours): the hosted page posts
 *   reference, result, txn, amount_minor, currency, ts, nonce, signature
 * where signature = HMAC-SHA256(key, "reference|result|txn|amount_minor|currency|ts|nonce").
 */
import { PROVIDER_RESULTS, type ProviderResult } from "../status";
import { hmacSha256Hex, safeEqual, secureReference, sha256Hex } from "../crypto";
import type { CallbackVerification, PaymentProvider } from "./types";

export const TEST_GATEWAY_FIELDS = ["reference", "result", "txn", "amount_minor", "currency", "ts", "nonce"] as const;
const MAX_AGE_MS = 15 * 60 * 1000;
const MAX_SKEW_MS = 60 * 1000;

export function canonical(fields: Record<string, string>): string {
  return TEST_GATEWAY_FIELDS.map((k) => fields[k] ?? "").join("|");
}

/** Signed form fields for one outcome (used by the hosted test page). */
export function signTestOutcome(
  key: string,
  input: { reference: string; result: ProviderResult; amountMinor: number; currency: string; now?: number },
): Record<string, string> {
  const fields: Record<string, string> = {
    reference: input.reference,
    result: input.result,
    txn: input.result === "paid" ? `TEST-${secureReference(12)}` : "",
    amount_minor: String(input.amountMinor),
    currency: input.currency,
    ts: String(input.now ?? Date.now()),
    nonce: secureReference(16),
  };
  return { ...fields, signature: hmacSha256Hex(key, canonical(fields)) };
}

export function verifyTestCallback(key: string, params: Record<string, string>, now = Date.now()): CallbackVerification {
  const reference = typeof params.reference === "string" && /^[A-Za-z0-9]{12,40}$/.test(params.reference) ? params.reference : null;
  const signature = params.signature ?? "";
  const dedupeKey = `test:${sha256Hex(`${signature}|${canonical(params)}`).slice(0, 64)}`;
  const reject = (reason: string): CallbackVerification => ({ verified: false, reference, reason, dedupeKey });

  for (const f of TEST_GATEWAY_FIELDS) if (typeof params[f] !== "string") return reject("missing_fields");
  if (!/^[0-9a-f]{64}$/.test(signature)) return reject("missing_signature");
  if (!safeEqual(signature, hmacSha256Hex(key, canonical(params)))) return reject("invalid_signature");
  const ts = Number(params.ts);
  if (!Number.isSafeInteger(ts) || now - ts > MAX_AGE_MS || ts - now > MAX_SKEW_MS) return reject("stale_or_future_timestamp");
  if (!reference) return reject("invalid_reference");
  if (!(PROVIDER_RESULTS as readonly string[]).includes(params.result)) return reject("unrecognised_status");
  const amount = /^\d{1,15}$/.test(params.amount_minor) ? Number(params.amount_minor) : null;

  return {
    verified: true,
    reference,
    result: params.result as ProviderResult,
    providerTxnId: params.txn || null,
    amountMinor: amount,
    currency: params.currency || null,
    dedupeKey,
    summary: { result: params.result, txn: params.txn.slice(0, 40) },
  };
}

export function testGatewayProvider(opts: { enabled: boolean; reason: string; key: string; baseUrl: string }): PaymentProvider {
  return {
    id: "test",
    label: "Sandbox test gateway",
    availability: () => ({ enabled: opts.enabled, reason: opts.reason }),
    async initiate(attempt) {
      if (!opts.enabled) throw new Error("Test gateway disabled");
      return { type: "redirect", url: `${opts.baseUrl}/payments/test-gateway?ref=${encodeURIComponent(attempt.reference)}` };
    },
    async verifyCallback({ params }) {
      if (!opts.enabled) {
        return { verified: false, reference: null, reason: "test_gateway_disabled", dedupeKey: `test:disabled:${sha256Hex(JSON.stringify(params)).slice(0, 48)}:${Date.now()}` };
      }
      return verifyTestCallback(opts.key, params);
    },
  };
}
