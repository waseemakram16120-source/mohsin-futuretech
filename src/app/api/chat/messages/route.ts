import { z } from "@/lib/z";
import { CHAT_ERRORS, clientIp, messageLimiter, sameOrigin, tooMany } from "@/lib/chat/http";
import { messageSchema } from "@/lib/chat/schemas";
import { resolveCaller } from "@/lib/chat/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ message: messageSchema }).strict();

/** POST /api/chat/messages — the customer sends a message in their conversation. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const limit = messageLimiter.check(clientIp(request.headers));
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const caller = await resolveCaller();
  if (!caller.conversationId) return Response.json({ error: "Start a chat first." }, { status: 404 });
  const { data, error } = await createAdminClient().rpc("chat_customer_post", {
    p_conversation_id: caller.conversationId,
    p_user_id: caller.userId,
    p_body: parsed.data.message,
  });
  if (error) {
    const known = CHAT_ERRORS[error.message];
    if (!known) console.error("[api/chat/messages] failed", error.code);
    return Response.json({ error: known?.message ?? "Message not sent. Please try again." }, { status: known?.status ?? 500 });
  }
  return Response.json({ message: data }, { status: 201 });
}
