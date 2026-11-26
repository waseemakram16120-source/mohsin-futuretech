import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — SERVER ONLY.
 *
 * Bypasses Row Level Security, so use it only in trusted server code
 * (admin actions, order processing, webhooks). Never import this file from
 * client components, and never expose SUPABASE_SERVICE_ROLE_KEY to the
 * browser. Throws a clear error when the key is not configured instead of
 * silently falling back to an unprivileged client.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase service-role client is not configured. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
