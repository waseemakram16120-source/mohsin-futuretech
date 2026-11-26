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
 * Never use it for anything user-specific.
 */
export function createPublicClient() {
  const env = getPublicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAG] },
        }),
    },
  });
}
