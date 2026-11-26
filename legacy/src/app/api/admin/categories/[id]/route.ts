/**
 * PATCH /api/admin/categories/[id] — update a category (live mode).
 * DELETE — delete a category (products keep their rows; category_id is
 * nullable, so set it to null first to avoid orphan references).
 */
import { NextResponse } from "next/server";
import { requireAdminAsync } from "@/lib/admin-auth";

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
    return NextResponse.json({ error: "Invalid category data." }, { status: 400 });
  }
  const { error } = await auth.admin
    .from("categories")
    .update({
      name: body.name,
      slug: body.slug,
      description: (body.description as string | null) ?? null,
      image_url: (body.image as string | null) || null,
      sort_order: Number(body.sortOrder ?? 0),
      is_active: body.isActive !== false,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Could not update the category." },
      { status: 500 },
    );
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
  await auth.admin.from("products").update({ category_id: null }).eq("category_id", id);
  const { error } = await auth.admin.from("categories").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Could not delete the category." },
      { status: 500 },
    );
  }
  return NextResponse.json({ mode: "live", ok: true });
}
