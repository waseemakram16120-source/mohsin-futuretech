import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Supabase client (Server Components, Server Actions, Route Handlers).
 *
 * `cookies()` is async in this Next.js version, so this factory is async too.
 * Reads the session from cookies and can write refreshed session cookies —
 * setting cookies is only allowed in Server Actions / Route Handlers, so the
 * setAll call is wrapped in try/catch when rendering Server Components.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — cookies can only be set in
            // Server Actions / Route Handlers. Safe to ignore here.
          }
        },
      },
    },
  );
}
