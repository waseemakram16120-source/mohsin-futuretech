import "server-only";

import { clientIp, createRateLimiter } from "@/lib/checkout/rate-limit";

const LIMIT = Number(process.env.CHAT_RATE_LIMIT) || 30;
// Messages: 30 per 10 minutes per IP; new conversations: a few per hour.
export const messageLimiter = createRateLimiter({ limit: LIMIT, windowMs: 10 * 60 * 1000 });
export const startLimiter = createRateLimiter({ limit: Math.max(5, Math.floor(LIMIT / 3)), windowMs: 60 * 60 * 1000 });

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function tooMany(seconds: number) {
  return Response.json(
    { error: "You're sending messages too quickly. Please wait a little and try again." },
    { status: 429, headers: { "Retry-After": String(seconds) } },
  );
}

export const CHAT_ERRORS: Record<string, { status: number; message: string }> = {
  conversation_closed: { status: 409, message: "This chat was closed. Start a new one to message us again." },
  conversation_not_found: { status: 404, message: "Chat not found." },
  invalid_message: { status: 400, message: "Type a message (up to 1000 characters)." },
  invalid_phone: { status: 400, message: "Enter a valid Pakistani mobile number, e.g. 0300 1234567." },
  invalid_name: { status: 400, message: "Enter your name." },
  invalid_order_number: { status: 400, message: "Order numbers look like MF-261127-00031." },
};

export { clientIp };
