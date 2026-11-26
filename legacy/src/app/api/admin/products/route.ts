/**
 * GET /api/admin/products — product list with variants (live mode).
 * POST — create a product with its variants.
 */
import { NextResponse } from "next/server";
import { requireAdminAsync } from "@/lib/admin-auth";
import { COLOR_HEX } from "@/lib/data/products";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET() {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo" });
  const [{ data: products }, { data: variants }, { data: categories }] =
    await Promise.all([
      auth.admin.from("products").select("*").order("created_at", { ascending: false }),
      auth.admin.from("product_variants").select("*"),
      auth.admin.from("categories").select("id, name, slug"),
    ]);
  const catMap = new Map(
    ((categories ?? []) as Array<Record<string, unknown>>).map((c) => [
      String(c.id),
      { name: String(c.name), slug: String(c.slug) },
    ]),
  );
  const variantsByProduct = new Map<string, Array<Record<string, unknown>>>();
  for (const v of (variants ?? []) as Array<Record<string, unknown>>) {
    const list = variantsByProduct.get(String(v.product_id)) ?? [];
    list.push(v);
    variantsByProduct.set(String(v.product_id), list);
  }
  const out = ((products ?? []) as Array<Record<string, unknown>>).map((p) => {
    const cat = catMap.get(String(p.category_id));
    return {
      id: String(p.id),
      categoryId: (p.category_id as string | null) ?? null,
      categorySlug: cat?.slug ?? "",
      categoryName: cat?.name ?? "—",
      name: String(p.name),
      slug: String(p.slug),
      description: (p.description as string | null) ?? "",
      price: Number(p.base_price ?? 0),
      compareAtPrice: (p.compare_at_price as number | null) ?? null,
      images: p.image_url ? [String(p.image_url)] : [],
      isFeatured: Boolean(p.is_featured),
      isNew: Boolean(p.is_new_arrival),
      isActive: Boolean(p.is_active),
      variants: (variantsByProduct.get(String(p.id)) ?? []).map((v) => ({
        id: String(v.id),
        sku: String(v.sku),
        size: String(v.size),
        color: String(v.color),
        colorHex: COLOR_HEX[String(v.color)] ?? "#6b7280",
        stock: Number(v.stock_quantity ?? 0),
        priceOverride: (v.price_override as number | null) ?? null,
      })),
      demo: false,
    };
  });
  return NextResponse.json({ mode: "live", products: out });
}

export async function POST(request: Request) {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo", ok: true });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid product data." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2) {
    return NextResponse.json({ error: "Product name is required." }, { status: 400 });
  }
  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "Enter a valid price." }, { status: 400 });
  }
  const variants = Array.isArray(body.variants) ? body.variants : [];
  const { data: product, error } = await auth.admin
    .from("products")
    .insert({
      category_id: (body.categoryId as string | null) ?? null,
      name,
      slug:
        typeof body.slug === "string" && body.slug.trim()
          ? body.slug.trim()
          : slugify(name),
      description: (body.description as string | null) ?? null,
      base_price: price,
      compare_at_price: (body.compareAtPrice as number | null) ?? null,
      image_url:
        Array.isArray(body.images) && body.images.length > 0
          ? String(body.images[0])
          : null,
      is_featured: Boolean(body.isFeatured),
      is_new_arrival: Boolean(body.isNew),
      is_active: body.isActive !== false,
    })
    .select("id")
    .single();
  if (error || !product) {
    return NextResponse.json(
      { error: "Could not create the product. The slug may already exist." },
      { status: 500 },
    );
  }
  const productId = (product as { id: string }).id;
  if (variants.length > 0) {
    const rows = (variants as Array<Record<string, unknown>>)
      .filter((v) => String(v.size ?? "").trim() && String(v.color ?? "").trim())
      .map((v) => ({
        product_id: productId,
        sku: String(v.sku ?? "").trim() || `MF-${productId.slice(0, 4).toUpperCase()}`,
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
  return NextResponse.json({ mode: "live", ok: true, id: productId });
}
