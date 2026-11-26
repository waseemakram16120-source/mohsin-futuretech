import { cookies } from "next/headers";
import { KNOWN_ORDER_ERRORS, orderErrorMessage } from "@/lib/checkout/errors";
import { ORDER_COOKIE, ORDER_COOKIE_MAX_AGE, rememberOrder, signOrders, verifyOrders } from "@/lib/checkout/order-access";
import { clientIp, createRateLimiter } from "@/lib/checkout/rate-limit";
import { fieldErrors, placeOrderSchema } from "@/lib/checkout/schema";
import { orderCookieKey } from "@/lib/checkout/server-keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 8 orders per 10 minutes per IP is plenty for a real shopper
// (ORDER_RATE_LIMIT overrides it, e.g. for automated tests).
const limiter = createRateLimiter({ limit: Number(process.env.ORDER_RATE_LIMIT) || 8, windowMs: 10 * 60 * 1000 });

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches may omit it; JSON + CORS still apply
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/**
 * POST /api/orders — validates the checkout (Zod), then calls the
 * place_order() database function, which re-prices every line, locks and
 * decrements stock, applies the coupon and records the payment, all in one
 * transaction. Guests are allowed; a signed-in customer is linked by id.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const limit = limiter.check(clientIp(request.headers));
  if (!limit.ok) {
    return Response.json(
      { error: "Too many orders from this connection. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid order data." }, { status: 400 });
  }
  const parsed = placeOrderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }
  const { customer, items, paymentMethod, couponCode } = parsed.data;

  let userId: string | null = null;
  try {
    const { data } = await (await createClient()).auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null; // signed out
  }

  const { data, error } = await createAdminClient().rpc("place_order", {
    p_user_id: userId,
    p_customer: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email || null,
      address: customer.address,
      city: customer.city,
      province: customer.province || null,
      postal_code: customer.postalCode || null,
      notes: customer.notes || null,
    },
    p_items: items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    p_payment_method: paymentMethod,
    p_coupon_code: couponCode || null,
  });

  if (error) {
    const code = error.message;
    if (KNOWN_ORDER_ERRORS.has(code)) {
      let detail: unknown = null;
      try {
        detail = error.details ? JSON.parse(error.details) : null;
      } catch {
        detail = error.details;
      }
      return Response.json({ error: orderErrorMessage(code), code, detail }, { status: 409 });
    }
    console.error("[api/orders] place_order failed", error);
    return Response.json({ error: orderErrorMessage("unknown") }, { status: 500 });
  }

  const order = data as { order_number: string; total_amount: number; payment_method: string; payment_status: string };
  const jar = await cookies();
  const key = orderCookieKey();
  jar.set(ORDER_COOKIE, signOrders(key, rememberOrder(verifyOrders(key, jar.get(ORDER_COOKIE)?.value), order.order_number)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !request.url.startsWith("http://localhost"),
    path: "/",
    maxAge: ORDER_COOKIE_MAX_AGE,
  });

  return Response.json(
    {
      orderNumber: order.order_number,
      totalAmount: Number(order.total_amount),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
    },
    { status: 201 },
  );
}
