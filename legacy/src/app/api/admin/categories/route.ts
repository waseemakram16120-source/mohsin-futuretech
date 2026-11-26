/**
 * GET /api/admin/categories — category list with product counts (live).
 * POST — create a category.
 */
import { NextResponse } from "next/server";
import { requireAdminAsync } from "@/lib/admin-auth";

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET() {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo" });
  const [{ data: categories }, { data: products }] = await Promise.all([
    auth.admin.from("categories").select("*").order("sort_order", { ascending: true }),
    auth.admin.from("products").select("id, category_id"),
  ]);
  const counts = new Map<string, number>();
  for (const p of (products ?? []) as Array<Record<string, unknown>>) {
    const key = String(p.category_id ?? "");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out = ((categories ?? []) as Array<Record<string, unknown>>).map((c) => ({
    id: String(c.id),
    name: String(c.name),
    slug: String(c.slug),
    description: (c.description as string | null) ?? "",
    image: (c.image_url as string | null) ?? "",
    sortOrder: Number(c.sort_order ?? 0),
    isActive: Boolean(c.is_active ?? true),
    productCount: counts.get(String(c.id)) ?? 0,
    demo: false,
  }));
  return NextResponse.json({ mode: "live", categories: out });
}

export async function POST(request: Request) {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo", ok: true });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid category data." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2) {
    return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  }
  const { error } = await auth.admin.from("categories").insert({
    name,
    slug:
      typeof body.slug === "string" && body.slug.trim()
        ? body.slug.trim()
        : slugify(name),
    description: (body.description as string | null) ?? null,
    image_url: (body.image as string | null) || null,
    sort_order: Number(body.sortOrder ?? 99),
    is_active: body.isActive !== false,
  });
  if (error) {
    return NextResponse.json(
      { error: "Could not create the category. The slug may already exist." },
      { status: 500 },
    );
  }
  return NextResponse.json({ mode: "live", ok: true });
}
