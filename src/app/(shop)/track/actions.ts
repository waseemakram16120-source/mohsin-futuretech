"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { issuesByField, trackSchema } from "@/lib/auth/schemas";
import { ORDER_COOKIE, ORDER_COOKIE_MAX_AGE, rememberOrder, signOrders, verifyOrders } from "@/lib/checkout/order-access";
import { clientIp, createRateLimiter } from "@/lib/checkout/rate-limit";
import { orderCookieKey } from "@/lib/checkout/server-keys";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TrackState {
  message?: string;
  errors?: Record<string, string>;
  values?: { orderNumber: string; phone: string };
}

// Guessing order numbers + phones is the risk here, so keep it tight.
const limiter = createRateLimiter({ limit: Number(process.env.TRACK_RATE_LIMIT) || 10, windowMs: 10 * 60 * 1000 });

/**
 * Order number + the phone used at checkout proves the customer knows the
 * order. On a match this browser is remembered for that order (signed
 * cookie) and sent to the full order page — the same access the checkout
 * browser has, so a guest can also submit payment details from here.
 */
export async function trackOrder(_prev: TrackState, form: FormData): Promise<TrackState> {
  const values = {
    orderNumber: typeof form.get("orderNumber") === "string" ? String(form.get("orderNumber")) : "",
    phone: typeof form.get("phone") === "string" ? String(form.get("phone")) : "",
  };
  const limit = limiter.check(clientIp(await headers()));
  if (!limit.ok) return { message: "Too many lookups. Please wait a few minutes and try again.", values };
  const parsed = trackSchema.safeParse(values);
  if (!parsed.success) return { errors: issuesByField(parsed.error), values };

  const { data, error } = await createAdminClient().rpc("resolve_order_access", {
    p_order_number: parsed.data.orderNumber,
    p_user_id: null,
    p_phone: parsed.data.phone,
  });
  if (error) {
    console.error("[track] lookup failed", error.code);
    return { message: "We couldn't look up orders right now. Please try again.", values };
  }
  if (!data) {
    // Same answer for a wrong number and a wrong phone.
    return { message: "We couldn't find an order with that number and phone. Please check both and try again.", values };
  }

  const jar = await cookies();
  const key = orderCookieKey();
  jar.set(ORDER_COOKIE, signOrders(key, rememberOrder(verifyOrders(key, jar.get(ORDER_COOKIE)?.value), parsed.data.orderNumber)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !(process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("http://localhost"),
    path: "/",
    maxAge: ORDER_COOKIE_MAX_AGE,
  });
  redirect(`/orders/${parsed.data.orderNumber}`);
}
