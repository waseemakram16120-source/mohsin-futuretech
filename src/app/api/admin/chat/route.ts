import { isAdminUser } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

/** GET /api/admin/chat?status=open|closed — inbox (admins only; RLS also applies). */
export async function GET(request: Request) {
  if (!(await isAdminUser())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const status = new URL(request.url).searchParams.get("status") === "closed" ? "closed" : "open";
  const supabase = await createClient();
  const [{ data, error }, waiting] = await Promise.all([
    supabase
      .from("chat_conversations")
      .select("id, customer_name, customer_phone, order_number, user_id, status, last_message_at, last_message_preview, last_sender, unread_for_admin, profile:profiles!chat_conversations_user_id_fkey(email)")
      .eq("status", status)
      .order("last_message_at", { ascending: false })
      .limit(100),
    supabase.from("chat_conversations").select("id", { count: "exact", head: true }).eq("status", "open").gt("unread_for_admin", 0),
  ]);
  if (error) return Response.json({ error: "Could not load chats." }, { status: 500 });
  return Response.json({ conversations: data ?? [], waiting: waiting.count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
