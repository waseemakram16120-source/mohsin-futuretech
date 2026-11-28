import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "recovery", "email", "email_change", "invite", "magiclink"]);

/**
 * GET /auth/confirm — landing point for links in Supabase Auth emails
 * (sign-up confirmation, password reset). Accepts the token_hash form
 * (email templates in supabase/templates) and the PKCE ?code= form.
 * `next` is restricted to paths on this site.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const fallback = type === "recovery" ? "/reset-password" : "/account";
  const next = safeNext(searchParams.get("next"), fallback);

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type && OTP_TYPES.has(type)) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  const target = ok ? next : `/login?error=link`;
  return NextResponse.redirect(new URL(target, request.url), { status: 303 });
}
