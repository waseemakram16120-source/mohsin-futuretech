import { NextResponse } from "next/server";

/**
 * Health-check Route Handler (Steps 1–6).
 * Proves the Node.js API layer works. Deliberately makes no database call,
 * so it stays green before Supabase credentials are configured.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "mohsin-futuretech",
    step: 6,
    timestamp: new Date().toISOString(),
  });
}
