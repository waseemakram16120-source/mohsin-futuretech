import { z } from "zod";
import { couponCodeSchema } from "@/lib/checkout/schema";
import { quoteCart } from "@/lib/orders/quote";

const bodySchema = z.object({
  items: z
    .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(10) }))
    .max(50),
  couponCode: couponCodeSchema.optional().default(""),
});

/** POST /api/cart/quote — live prices, stock, coupon and totals for a bag. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid bag." }, { status: 400 });
  try {
    const quote = await quoteCart(parsed.data.items, parsed.data.couponCode);
    return Response.json(quote, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/cart/quote]", error);
    return Response.json({ error: "We couldn't load your bag. Please try again." }, { status: 502 });
  }
}
