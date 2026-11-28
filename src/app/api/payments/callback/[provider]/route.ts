import { clientIp, createRateLimiter } from "@/lib/checkout/rate-limit";
import { handleCallback } from "@/lib/payments/service";

// Generous: must never block genuine provider deliveries, only floods.
const limiter = createRateLimiter({ limit: 300, windowMs: 60 * 1000 });
const MAX_FIELDS = 60;
const MAX_VALUE = 2000;

async function readParams(request: Request): Promise<Record<string, string> | null> {
  const params: Record<string, string> = {};
  const add = (k: string, v: unknown) => {
    if (typeof v !== "string" || k.length > 100 || v.length > MAX_VALUE) return false;
    params[k] = v;
    return Object.keys(params).length <= MAX_FIELDS;
  };
  if (request.method === "GET") {
    for (const [k, v] of new URL(request.url).searchParams) if (!add(k, v)) return null;
    return params;
  }
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const json = await request.json();
      if (!json || typeof json !== "object" || Array.isArray(json)) return null;
      for (const [k, v] of Object.entries(json)) if (!add(k, v)) return null;
    } else {
      const form = await request.formData();
      for (const [k, v] of form) if (!add(k, v)) return null;
    }
  } catch {
    return null;
  }
  return params;
}

/**
 * Provider callback / browser return. Everything is untrusted until the
 * provider adapter verifies it; the order page then shows the status from
 * the database — never from these parameters. The redirect target is built
 * from our own order number only (no open redirect).
 */
async function handle(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!limiter.check(clientIp(request.headers)).ok) return new Response("Too many requests", { status: 429 });
  const fields = await readParams(request);
  if (!fields) return new Response("Bad request", { status: 400 });

  let orderNumber: string | null = null;
  try {
    ({ orderNumber } = await handleCallback(provider, request.method, fields));
  } catch {
    // Not acknowledged as processed: the provider/customer may retry.
    return new Response("Temporarily unavailable", { status: 503 });
  }
  const target = orderNumber ? `/orders/${encodeURIComponent(orderNumber)}?payment=return` : "/track";
  return Response.redirect(new URL(target, request.url), 303);
}

export { handle as GET, handle as POST };
