/**
 * GET /api/admin/orders/[id] — one order with items + payment (live mode).
 * PATCH — update the order status (PDF §7 workflow). Server-side admin
 * check on every call; approving a payment separately confirms the order.
 */
import { NextResponse } from "next/server";
import { requireAdminAsync } from "@/lib/admin-auth";
import { fetchLiveOrders } from "@/lib/admin-live";
import type { OrderStatus } from "@/lib/types";

const STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo" });
  const { id } = await params;
  const orders = await fetchLiveOrders(auth.admin);
  const order = orders.find((o) => o.id === id || o.orderNumber === id);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  return NextResponse.json({ mode: "live", order });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo", ok: true });
  const { id } = await params;
  let body: { status?: unknown };
  try {
    body = (await request.json()) as { status?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const status = body.status as OrderStatus | undefined;
  if (!status || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid order status." }, { status: 400 });
  }
  const { error } = await auth.admin
    .from("orders")
    .update({ status })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Could not update the order status." },
      { status: 500 },
    );
  }
  return NextResponse.json({ mode: "live", ok: true, status });
}
