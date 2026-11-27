import { z } from "zod";
import { clientIp, createRateLimiter } from "@/lib/checkout/rate-limit";
import { MAX_RECEIPT_BYTES, evidenceFieldsSchema } from "@/lib/payments/evidence";
import { submitEvidence } from "@/lib/payments/manual";

const limiter = createRateLimiter({ limit: Number(process.env.PAYMENT_RATE_LIMIT) || 10, windowMs: 10 * 60 * 1000 });
const orderNumberSchema = z.string().regex(/^MF-\d{6}-\d{5,}$/i);
// Receipt (5 MB) plus the text fields and multipart overhead.
const MAX_BODY_BYTES = MAX_RECEIPT_BYTES + 64 * 1024;

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
 * POST /api/payments/evidence (multipart) — manual EasyPaisa / JazzCash
 * payment: orderNumber, transactionId, optional note and the receipt image.
 * Only the browser that placed the order or its signed-in owner may submit.
 * The result is always "Pending Verification"; never approved or paid.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const limit = limiter.check(clientIp(request.headers));
  if (!limit.ok) {
    return Response.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return Response.json({ error: "The receipt image must be 5 MB or smaller." }, { status: 413 });
  if (!(request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const allowed = new Set(["orderNumber", "transactionId", "note", "receipt"]);
  for (const key of form.keys()) {
    if (!allowed.has(key)) return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const orderNumber = orderNumberSchema.safeParse(form.get("orderNumber"));
  if (!orderNumber.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const fields = evidenceFieldsSchema.safeParse({
    transactionId: typeof form.get("transactionId") === "string" ? form.get("transactionId") : "",
    note: typeof form.get("note") === "string" ? form.get("note") : "",
  });
  if (!fields.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of fields.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return Response.json({ error: "Please correct the highlighted fields.", fieldErrors }, { status: 400 });
  }
  const receipt = form.get("receipt");
  if (!(receipt instanceof File) || receipt.size === 0) {
    return Response.json(
      { error: "Attach a screenshot or photo of your payment receipt.", fieldErrors: { receipt: "Attach a screenshot or photo of your payment receipt." } },
      { status: 400 },
    );
  }

  try {
    const result = await submitEvidence(orderNumber.data, fields.data, receipt);
    if (!result.ok) return Response.json({ error: result.message }, { status: result.status });
    return Response.json({ paymentStatus: result.paymentStatus }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/payments/evidence]", (error as Error).message);
    return Response.json({ error: "We couldn't save your payment details. Please try again." }, { status: 500 });
  }
}
