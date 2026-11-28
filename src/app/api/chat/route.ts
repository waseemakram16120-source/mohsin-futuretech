import { z } from "@/lib/z";
import { getProfile } from "@/lib/auth/session";
import { issuesByField } from "@/lib/auth/schemas";
import { CHAT_ERRORS, clientIp, sameOrigin, startLimiter, tooMany } from "@/lib/chat/http";
import { startChatSchema } from "@/lib/chat/schemas";
import { newGuestCredentials, resolveCaller, setGuestCookie } from "@/lib/chat/server";
import { createAdminClient } from "@/lib/supabase/admin";

const afterSchema = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).catch(0);

/** GET /api/chat?after=<id> — the caller's conversation and new messages. */
export async function GET(request: Request) {
  const caller = await resolveCaller();
  const profile = caller.userId ? await getProfile() : null;
  const me = caller.userId ? { signedIn: true, name: profile?.fullName ?? "", phone: profile?.phone ?? null } : { signedIn: false, name: "", phone: null };
  if (!caller.conversationId) {
    return Response.json({ conversation: null, messages: [], me }, { headers: { "Cache-Control": "no-store" } });
  }
  const after = afterSchema.parse(new URL(request.url).searchParams.get("after") ?? 0);
  const { data, error } = await createAdminClient().rpc("chat_customer_read", { p_conversation_id: caller.conversationId, p_after_id: after });
  if (error) return Response.json({ error: "Could not load messages." }, { status: 500 });
  return Response.json({ ...(data as object), me }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/chat — start a conversation with the first message. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const limit = startLimiter.check(clientIp(request.headers));
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = startChatSchema.strict().safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please check the highlighted fields.", fieldErrors: issuesByField(parsed.error) }, { status: 400 });

  const caller = await resolveCaller();
  const guest = caller.userId ? null : newGuestCredentials();
  const { data, error } = await createAdminClient().rpc("chat_start", {
    p_user_id: caller.userId,
    p_guest_token_hash: guest?.hash ?? null,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
    p_order_number: parsed.data.orderNumber,
    p_body: parsed.data.message,
  });
  if (error) {
    const known = CHAT_ERRORS[error.message];
    if (!known) console.error("[api/chat] start failed", error.code);
    return Response.json({ error: known?.message ?? "We couldn't start the chat. Please try again." }, { status: known?.status ?? 500 });
  }
  const conversationId = (data as { conversation_id: string }).conversation_id;
  if (guest) {
    await setGuestCookie(conversationId, guest.token, process.env.NODE_ENV === "production" && !request.url.startsWith("http://localhost"));
  }
  return Response.json({ conversationId }, { status: 201 });
}
