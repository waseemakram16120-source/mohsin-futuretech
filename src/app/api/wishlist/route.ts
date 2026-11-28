import { z } from "@/lib/z";
import { storeConfig } from "@/config/store";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Not imported from lib/stores/wishlist: that module is client-only.
const MAX_WISHLIST = storeConfig.wishlist.maxItems;

const entry = z.object({ productId: z.string().uuid(), variantId: z.string().uuid().nullable().default(null) }).strict();
const bodySchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), productId: z.string().uuid(), variantId: z.string().uuid().nullable().default(null) }).strict(),
  z.object({ op: z.literal("remove"), productId: z.string().uuid() }).strict(),
  z.object({ op: z.literal("merge"), entries: z.array(entry).max(MAX_WISHLIST) }).strict(),
]);

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function list(userId: string) {
  const { data, error } = await (await createClient())
    .from("wishlist")
    .select("product_id, variant_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_WISHLIST);
  if (error) throw error;
  return (data ?? []).map((r) => ({ productId: r.product_id, variantId: r.variant_id, addedAt: r.created_at }));
}

/** GET /api/wishlist — the signed-in customer's saved items. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });
  try {
    return Response.json({ entries: await list(user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load wishlist." }, { status: 500 });
  }
}

/**
 * POST /api/wishlist — add / remove one item, or merge the guest wishlist
 * from this browser after sign-in. Rows are always the caller's own (RLS).
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await createClient();
  const b = parsed.data;
  const rows =
    b.op === "add" ? [{ productId: b.productId, variantId: b.variantId }] : b.op === "merge" ? b.entries : [];
  if (rows.length > 0) {
    // Ignore products that no longer exist (FK) by inserting only known ids.
    const { data: known } = await supabase.from("products").select("id").in("id", rows.map((r) => r.productId));
    const ok = new Set((known ?? []).map((p) => p.id));
    const insert = rows
      .filter((r) => ok.has(r.productId))
      .map((r) => ({ user_id: user.id, product_id: r.productId, variant_id: r.variantId }));
    if (insert.length > 0) {
      const { error } = await supabase.from("wishlist").upsert(insert, { onConflict: "user_id,product_id", ignoreDuplicates: true });
      if (error) {
        console.error("[api/wishlist] save failed", error.code);
        return Response.json({ error: "Could not save wishlist." }, { status: 500 });
      }
    }
  }
  if (b.op === "remove") {
    await supabase.from("wishlist").delete().eq("user_id", user.id).eq("product_id", b.productId);
  }
  try {
    return Response.json({ entries: await list(user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load wishlist." }, { status: 500 });
  }
}
