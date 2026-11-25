import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth confirm — exchanges the Supabase email-link code for a session.
 *
 * Supabase recovery (and confirmation) emails link here in two shapes:
 *   1) ?code=...            — PKCE code from /auth/v1/verify, exchanged with
 *                             exchangeCodeForSession().
 *   2) ?token_hash=...&type=recovery — direct OTP link, verified with
 *                             verifyOtp().
 * Either way the user ends up signed in and is sent to `next`
 * (default /reset-password). A bad or expired link goes to /login with an
 * error flag instead of a broken page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/reset-password";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("reset-link-expired")}`, request.url),
    );
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("reset-link-expired")}`, request.url),
    );
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
