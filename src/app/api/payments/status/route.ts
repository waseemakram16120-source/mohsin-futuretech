import { paymentState } from "@/lib/payments/service";

/** GET /api/payments/status?order=MF-… — payment state for an authorised order (polling). */
export async function GET(request: Request) {
  const order = new URL(request.url).searchParams.get("order") ?? "";
  if (!/^MF-\d{6}-\d{5,}$/i.test(order)) return Response.json({ error: "Invalid order." }, { status: 400 });
  try {
    const state = await paymentState(order);
    if (!state) return Response.json({ error: "Order not found." }, { status: 404 });
    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load payment status." }, { status: 500 });
  }
}
