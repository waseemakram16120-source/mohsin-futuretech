/** GET /api/admin/payments — payment submissions list (Step 5, live mode). */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdminAsync } from "@/lib/admin-auth";
import { fetchLivePayments } from "@/lib/admin-live";

export async function GET() {
  // Reading headers opts this GET out of static caching (Next 16 Cache
  // Components) — admin data must always be fresh.
  await headers();
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo" });
  const payments = await fetchLivePayments(auth.admin);
  return NextResponse.json({ mode: "live", payments });
}

