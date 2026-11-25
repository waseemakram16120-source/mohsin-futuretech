/** GET /api/admin/customers/[id] — one customer + their orders (live). */
import { NextResponse } from "next/server";
import { requireAdminAsync } from "@/lib/admin-auth";
import { fetchLiveCustomers, fetchLiveOrders } from "@/lib/admin-live";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo" });
  const { id } = await params;
  const customers = await fetchLiveCustomers(auth.admin);
  const customer = customers.find((c) => c.id === id);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }
  const orders = (await fetchLiveOrders(auth.admin)).filter(
    (o) => o.userId === customer.id || o.phone === customer.phone,
  );
  return NextResponse.json({ mode: "live", customer, orders });
}
