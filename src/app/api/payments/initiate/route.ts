import { z } from "@/lib/z";
import { clientIp, createRateLimiter } from "@/lib/checkout/rate-limit";
import { initiatePayment } from "@/lib/payments/service";

const limiter = createRateLimiter({ limit: Number(process.env.PAYMENT_RATE_LIMIT) || 10, windowMs: 10 * 60 * 1000 });
const bodySchema = z.object({ orderNumber: z.string().regex(/^MF-\d{6}-\d{5,}$/i) }).strict();

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/**
 * POST /api/payments/initiate { orderNumber } — starts (or safely re-uses)
 * a gateway payment for an order the caller is authorised for. The body
 * cannot carry an amount, provider, status or transaction id (.strict()).
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const limit = limiter.check(clientIp(request.headers));
  if (!limit.ok) {
    return Response.json(
      { error: "Too many payment attempts. Please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  try {
    const result = await initiatePayment(parsed.data.orderNumber);
    if (!result.ok) return Response.json({ error: result.message }, { status: result.status });
    return Response.json({ action: result.action, testGateway: result.testGateway }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/payments/initiate]", (error as Error).message);
    return Response.json({ error: "We couldn't start the payment. Please try again." }, { status: 500 });
  }
}
