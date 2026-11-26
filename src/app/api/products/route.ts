import { z } from "zod";
import { getProductCardsByIds } from "@/lib/catalog/queries";

const querySchema = z.object({
  ids: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.string().uuid()).min(1).max(100)),
});

/**
 * GET /api/products?ids=<uuid>,<uuid> — public product cards (active
 * products only, via RLS) for client lists such as the wishlist.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ ids: url.searchParams.get("ids") ?? "" });
  if (!parsed.success) {
    return Response.json({ error: "Provide 1–100 product ids." }, { status: 400 });
  }
  try {
    const products = await getProductCardsByIds(Array.from(new Set(parsed.data.ids)));
    return Response.json({ products }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
  } catch (error) {
    console.error("[api/products]", error);
    return Response.json({ error: "Could not load products." }, { status: 502 });
  }
}
