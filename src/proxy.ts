import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the Supabase Auth session fresh: an expired access token is
 * refreshed here and the new cookies are written to both the request (for
 * the page rendering now) and the response (for the browser).
 *
 * Runs only on routes that read the session, so catalogue pages stay
 * static and fast. Authorisation is NOT done here: every page, action and
 * route checks the user itself (Next.js guidance: proxy is optimistic only).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Triggers the refresh when needed. Do not add code between the client
  // creation and this call.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    "/account/:path*",
    "/checkout",
    "/orders/:path*",
    "/track",
    "/wishlist",
    "/login",
    "/signup",
    "/reset-password",
    "/auth/:path*",
    "/api/orders",
    "/api/payments/:path*",
    "/api/wishlist/:path*",
  ],
};
