import "server-only";

import { createHmac } from "node:crypto";

/**
 * Key for signing the order-access cookie, derived from the service-role
 * key so no extra secret has to be configured. Rotating the service-role
 * key simply invalidates old cookies.
 */
export function orderCookieKey(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createHmac("sha256", secret).update("mft-order-access-cookie-v1").digest("hex");
}
