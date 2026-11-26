import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

/**
 * Service-role Supabase client — SERVER ONLY, bypasses RLS.
 *
 * Used only for the few trusted operations that guests must be able to
 * trigger (placing an order, submitting payment evidence, uploading a
 * receipt). Those operations go through SECURITY DEFINER database functions
 * that re-validate everything. Admin screens use the signed-in admin's own
 * session (RLS + is_admin()) instead of this client.
 */
export function createAdminClient() {
  const env = getPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server-only, see .env.example).");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
