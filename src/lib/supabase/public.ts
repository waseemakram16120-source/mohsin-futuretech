import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

/** Seconds that public catalogue reads are cached before refreshing. */
export const CATALOG_REVALIDATE_SECONDS = 60;
/** Cache tag: admin edits call revalidateTag(CATALOG_TAG) to refresh at once. */
export const CATALOG_TAG = "catalog";

/**
 * Cookie-less, anonymous Supabase client for PUBLIC catalogue data
 * (products, categories, settings). Because it never reads cookies, pages
 * that use it can be cached and served fast; RLS still applies (anon role).
 * Never use it for anything user-specific. Pass { cached: false } for
 * reads that must be live (stock and prices in the bag and at checkout).
 */
export function createPublicClient({ cached = true }: { cached?: boolean } = {}) {
  const env = getPublicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      // Cart/checkout reads (live stock and prices) are never cached.
      fetch: (input, init) =>
        cached
          ? fetch(input, { ...init, next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAG] } })
          : fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
