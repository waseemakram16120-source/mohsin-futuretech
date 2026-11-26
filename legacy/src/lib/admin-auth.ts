/**
 * Server-side admin check (Step 5).
 *
 * Every /api/admin/* route calls requireAdmin() first. It returns
 * `{ mode: "demo" }` when Supabase is not configured (the client then
 * works with local demo data), or the live service-role client + admin
 * user id when the signed-in user has profiles.role = 'admin'.
 * Anything else throws a NextResponse (401 not signed in, 403 not admin)
 * — never trust the client.
 */
import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/data/store";

export type AdminAuth =
  | { mode: "demo" }
  | {
      mode: "live";
      admin: ReturnType<typeof getSupabaseAdmin>;
      userId: string;
    };

export async function requireAdminAsync(): Promise<AdminAuth> {
  if (!isSupabaseConfigured()) return { mode: "demo" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    throw NextResponse.json(
      { error: "Please sign in as an admin." },
      { status: 401 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin") {
    throw NextResponse.json(
      { error: "Access denied — admin account required." },
      { status: 403 },
    );
  }
  return { mode: "live", admin, userId: user.id };
}

/** Signed receipt URL for a private-bucket path (live mode only). */
export async function signedReceiptUrl(
  admin: ReturnType<typeof getSupabaseAdmin>,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await admin.storage
    .from("payment-receipts")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
