import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session-refresh proxy (Step 3 follow-up fix, 2026-11-24).
 *
 * Why this exists: the store had no middleware/proxy, so the Supabase
 * session cookie was only refreshed by the browser client. When a token
 * refresh failed (e.g. the sign-in/refresh rate limit on the visitor's IP,
 * which the owner hit on 2026-11-24), the session silently died and the
 * My Account guard sent the signed-in owner back to /login — the
 * "address add karte hi login pe wapis" bounce. This proxy calls
 * getUser() on every page/API request, refreshing an expiring session and
 * writing the fresh cookies back, so the session stays alive across
 * navigations. The refresh now runs from the server (Vercel), not from
 * the visitor's IP bucket.
 *
 * It never breaks the site: in demo mode (no Supabase env vars) it
 * passes the request through untouched, and any refresh failure is
 * swallowed — the browser client still handles auth as before.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || url.includes("placeholder")) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  try {
    // Refreshes the session when it is expired; writes fresh cookies.
    await supabase.auth.getUser();
  } catch {
    // Never break a page because a refresh failed.
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
