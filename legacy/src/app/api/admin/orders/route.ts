/** GET /api/admin/orders — order list for the admin (Step 5, live mode). */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdminAsync } from "@/lib/admin-auth";
import { fetchLiveOrders } from "@/lib/admin-live";

export async function GET() {
  // Reading headers opts this GET out of static caching (Next 16 Cache
  // Components) — admin data must always be fresh.
  await headers();
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo" });
  const orders = await fetchLiveOrders(auth.admin);
  return NextResponse.json({ mode: "live", orders });
}

