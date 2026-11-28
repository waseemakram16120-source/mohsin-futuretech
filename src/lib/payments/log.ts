/**
 * Structured payment logging with redaction (payment spec §11). Only safe,
 * whitelisted fields are ever written — never secrets, hashes, PINs, OTPs
 * or full provider payloads.
 */
const SAFE_KEYS = new Set([
  "event", "provider", "reference", "orderNumber", "outcome", "reason", "status", "result",
  "eventType", "correlationId", "reused", "amountMinor", "durationMs", "httpStatus",
]);

export function redact(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!SAFE_KEYS.has(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 120);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
  }
  return out;
}

export function logPayment(level: "info" | "warn" | "error", fields: Record<string, unknown>) {
  const line = JSON.stringify({ scope: "payments", level, at: new Date().toISOString(), ...redact(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
