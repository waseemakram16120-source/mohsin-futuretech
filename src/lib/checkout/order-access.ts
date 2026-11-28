/**
 * Signed list of order numbers placed from this browser, kept in an
 * httpOnly cookie, so the confirmation page survives a refresh without
 * exposing orders to anyone else. HMAC-SHA256; tampering invalidates it.
 * Pure functions (key passed in) so they are unit-tested.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const ORDER_COOKIE = "mft_orders";
export const ORDER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const MAX_ORDERS = 10;
const ORDER_RE = /^MF-\d{6}-\d{5,}$/;

function mac(key: string, payload: string) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function signOrders(key: string, orders: string[]): string {
  const list = orders.filter((o) => ORDER_RE.test(o)).slice(0, MAX_ORDERS);
  const payload = Buffer.from(JSON.stringify(list)).toString("base64url");
  return `${payload}.${mac(key, payload)}`;
}

export function verifyOrders(key: string, value: string | undefined | null): string[] {
  if (!value) return [];
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return [];
  const expected = Buffer.from(mac(key, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return [];
  try {
    const list: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Array.isArray(list) ? list.filter((o): o is string => typeof o === "string" && ORDER_RE.test(o)) : [];
  } catch {
    return [];
  }
}

/** Newest first, de-duplicated, capped. */
export function rememberOrder(existing: string[], orderNumber: string): string[] {
  return [orderNumber, ...existing.filter((o) => o !== orderNumber)].slice(0, MAX_ORDERS);
}
