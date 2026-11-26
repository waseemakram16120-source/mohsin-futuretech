/**
 * GET /api/admin/products/[id] — one product (live mode).
 * PATCH — update product + replace its variants.
 * DELETE — delete product (variants cascade via FK).
 */
import { NextResponse } from "next/server";
import { requireAdminAsync } from "@/lib/admin-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo" });
  const { id } = await params;
  // Reuse the list endpoint logic by querying directly.
  const [{ data: product }, { data: variants }, { data: categories }] =
    await Promise.all([
      auth.admin.from("products").select("*").eq("id", id).single(),
      auth.admin.from("product_variants").select("*").eq("product_id", id),
      auth.admin.from("categories").select("id, name, slug"),
    ]);
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  const p = product as Record<string, unknown>;
  const cat = ((categories ?? []) as Array<Record<string, unknown>>).find(
    (c) => String(c.id) === String(p.category_id),
  );
  return NextResponse.json({
    mode: "live",
    product: {
      id: String(p.id),
      categoryId: (p.category_id as string | null) ?? null,
      categorySlug: cat ? String(cat.slug) : "",
      categoryName: cat ? String(cat.name) : "—",
      name: String(p.name),
      slug: String(p.slug),
      description: (p.description as string | null) ?? "",
      price: Number(p.base_price ?? 0),
      compareAtPrice: (p.compare_at_price as number | null) ?? null,
      images: p.image_url ? [String(p.image_url)] : [],
      isFeatured: Boolean(p.is_featured),
      isNew: Boolean(p.is_new_arrival),
      isActive: Boolean(p.is_active),
      variants: ((variants ?? []) as Array<Record<string, unknown>>).map((v) => ({
        id: String(v.id),
        sku: String(v.sku),
        size: String(v.size),
        color: String(v.color),
        colorHex: "#6b7280",
        stock: Number(v.stock_quantity ?? 0),
        priceOverride: (v.price_override as number | null) ?? null,
      })),
      demo: false,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo", ok: true });
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid product data." }, { status: 400 });
  }
  const { error } = await auth.admin
    .from("products")
    .update({
      category_id: (body.categoryId as string | null) ?? null,
      name: body.name,
      slug: body.slug,
      description: (body.description as string | null) ?? null,
      base_price: Number(body.price),
      compare_at_price: (body.compareAtPrice as number | null) ?? null,
      image_url:
        Array.isArray(body.images) && body.images.length > 0
          ? String(body.images[0])
          : null,
      is_featured: Boolean(body.isFeatured),
      is_new_arrival: Boolean(body.isNew),
      is_active: body.isActive !== false,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Could not update the product." },
      { status: 500 },
    );
  }
  // Replace variants wholesale — simplest correct behaviour for admin edits.
  if (Array.isArray(body.variants)) {
    await auth.admin.from("product_variants").delete().eq("product_id", id);
    const rows = (body.variants as Array<Record<string, unknown>>)
      .filter((v) => String(v.size ?? "").trim() && String(v.color ?? "").trim())
      .map((v) => ({
        product_id: id,
        sku: String(v.sku ?? "").trim() || `MF-${id.slice(0, 4).toUpperCase()}`,
        size: String(v.size),
        color: String(v.color),
        price_override: (v.priceOverride as number | null) ?? null,
        stock_quantity: Number(v.stock ?? 0),
        is_active: true,
      }));
    if (rows.length > 0) {
      await auth.admin.from("product_variants").insert(rows);
    }
  }
  return NextResponse.json({ mode: "live", ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo", ok: true });
  const { id } = await params;
  const { error } = await auth.admin.from("products").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Could not delete the product." },
      { status: 500 },
    );
  }
  return NextResponse.json({ mode: "live", ok: true });
}
