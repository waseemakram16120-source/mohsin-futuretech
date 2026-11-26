/** GET /api/admin/reports?range=today|7d|30d|all (live mode). */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdminAsync } from "@/lib/admin-auth";
import { fetchLiveReport } from "@/lib/admin-live";

export async function GET(request: Request) {
  // Reading headers opts this GET out of static caching (Next 16 Cache
  // Components) — admin data must always be fresh.
  await headers();
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo" });
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "30d";
  const report = await fetchLiveReport(auth.admin, range);
  return NextResponse.json({ mode: "live", report });
}

