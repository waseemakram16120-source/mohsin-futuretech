/**
 * GET /api/admin/inventory — stock by variant (live mode).
 * PATCH — set a variant's stock quantity.
 */
import { NextResponse } from "next/server";
import { requireAdminAsync } from "@/lib/admin-auth";

export async function GET() {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo" });
  const [{ data: variants }, { data: products }] = await Promise.all([
    auth.admin.from("product_variants").select("*").order("created_at", { ascending: true }),
    auth.admin.from("products").select("id, name, slug"),
  ]);
  const names = new Map(
    ((products ?? []) as Array<Record<string, unknown>>).map((p) => [
      String(p.id),
      String(p.name),
    ]),
  );
  const out = ((variants ?? []) as Array<Record<string, unknown>>).map((v) => ({
    id: String(v.id),
    productId: String(v.product_id),
    productName: names.get(String(v.product_id)) ?? "Product",
    sku: String(v.sku),
    size: String(v.size),
    color: String(v.color),
    stock: Number(v.stock_quantity ?? 0),
  }));
  return NextResponse.json({ mode: "live", inventory: out });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo", ok: true });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const variantId = String(body.variantId ?? "");
  const stock = Number(body.stock);
  if (!variantId || !Number.isInteger(stock) || stock < 0) {
    return NextResponse.json(
      { error: "Enter a valid stock quantity (0 or more)." },
      { status: 400 },
    );
  }
  const { error } = await auth.admin
    .from("product_variants")
    .update({ stock_quantity: stock })
    .eq("id", variantId);
  if (error) {
    return NextResponse.json(
      { error: "Could not update the stock." },
      { status: 500 },
    );
  }
  return NextResponse.json({ mode: "live", ok: true });
}
