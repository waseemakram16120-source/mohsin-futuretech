import { z } from "@/lib/z";
import { isAdminUser } from "@/lib/admin/auth";
import { CHAT_ERRORS, sameOrigin } from "@/lib/chat/http";
import { messageSchema } from "@/lib/chat/schemas";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();
const afterSchema = z.coerce.number().int().min(0).catch(0);

/** GET — one conversation and its messages after ?after=<id>; marks it read. */
export async function GET(request: Request, { params }: Ctx) {
  if (!(await isAdminUser())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Not found" }, { status: 404 });
  const after = afterSchema.parse(new URL(request.url).searchParams.get("after") ?? 0);
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id, customer_name, customer_phone, order_number, user_id, status, created_at, profile:profiles!chat_conversations_user_id_fkey(email, full_name)")
    .eq("id", id.data)
    .maybeSingle();
  if (!conversation) return Response.json({ error: "Not found" }, { status: 404 });
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, sender, body, created_at, sender_profile:profiles(full_name)")
    .eq("conversation_id", id.data)
    .gt("id", after)
    .order("id")
    .limit(500);
  await supabase.rpc("chat_admin_mark_read", { p_conversation_id: id.data });
  return Response.json({ conversation, messages: messages ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

const postSchema = z.union([
  z.object({ message: messageSchema }).strict(),
  z.object({ status: z.enum(["open", "closed"]) }).strict(),
]);

/** POST — reply { message } or close/reopen { status }. */
export async function POST(request: Request, { params }: Ctx) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (!(await isAdminUser())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Not found" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Type a reply (up to 1000 characters)." }, { status: 400 });
  const supabase = await createClient();
  const { data, error } =
    "message" in parsed.data
      ? await supabase.rpc("chat_admin_reply", { p_conversation_id: id.data, p_body: parsed.data.message })
      : await supabase.rpc("chat_admin_set_status", { p_conversation_id: id.data, p_status: parsed.data.status });
  if (error) {
    const known = CHAT_ERRORS[error.message];
    return Response.json({ error: known?.message ?? "Could not save. Please try again." }, { status: known?.status ?? 500 });
  }
  return Response.json({ ok: true, message: data ?? null }, { status: 201 });
}
