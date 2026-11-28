"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/redirect";
import { forgotPasswordSchema, issuesByField, loginSchema, resetPasswordSchema, signupSchema } from "@/lib/auth/schemas";
import { clientIp, createRateLimiter } from "@/lib/checkout/rate-limit";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Echoed back so the form keeps what the user typed (never passwords). */
  values?: Record<string, string>;
}

// Per-IP limits on top of Supabase Auth's own limits (AUTH_RATE_LIMIT for tests).
const AUTH_LIMIT = Number(process.env.AUTH_RATE_LIMIT) || 10;
const loginLimiter = createRateLimiter({ limit: AUTH_LIMIT, windowMs: 10 * 60 * 1000 });
const signupLimiter = createRateLimiter({ limit: AUTH_LIMIT, windowMs: 60 * 60 * 1000 });
const emailLimiter = createRateLimiter({ limit: Math.max(3, Math.floor(AUTH_LIMIT / 2)), windowMs: 60 * 60 * 1000 });

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
const str = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

async function ip() {
  return clientIp(await headers());
}

function siteUrl(path: string) {
  return new URL(path, getPublicEnv().NEXT_PUBLIC_SITE_URL).toString();
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { email: str(form, "email") };
  if (!loginLimiter.check(await ip()).ok) return { message: TOO_MANY, values };
  const parsed = loginSchema.safeParse({ email: values.email, password: str(form, "password") });
  if (!parsed.success) return { errors: issuesByField(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // One message for every failure: no hint whether the email exists.
    const unconfirmed = error.code === "email_not_confirmed";
    return {
      message: unconfirmed
        ? "Please confirm your email first — we sent you a link when you signed up."
        : "Email or password is incorrect.",
      values,
    };
  }
  redirect(safeNext(form.get("next")));
}

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { name: str(form, "name"), email: str(form, "email") };
  if (!signupLimiter.check(await ip()).ok) return { message: TOO_MANY, values };
  const parsed = signupSchema.safeParse({
    name: values.name,
    email: values.email,
    password: str(form, "password"),
    confirmPassword: str(form, "confirmPassword"),
  });
  if (!parsed.success) return { errors: issuesByField(parsed.error), values };

  const next = safeNext(form.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: siteUrl(`/auth/confirm?next=${encodeURIComponent(next)}`),
    },
  });
  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { errors: { email: "An account with this email already exists. Sign in instead." }, values };
    }
    if (error.code === "weak_password") return { errors: { password: "Choose a stronger password." }, values };
    console.error("[auth] sign-up failed", error.code);
    return { message: "We couldn't create your account right now. Please try again.", values };
  }
  // Email confirmation off → signed in now. On → the user must click the link.
  if (data.session) redirect(next);
  return {
    ok: true,
    message: `Almost done! We sent a confirmation link to ${parsed.data.email}. Open it to activate your account.`,
  };
}

export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { email: str(form, "email") };
  if (!emailLimiter.check(await ip()).ok) return { message: TOO_MANY, values };
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { errors: issuesByField(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: siteUrl("/auth/confirm?next=/reset-password"),
  });
  if (error && error.status !== 429) console.error("[auth] reset email failed", error.code);
  // Same answer whether or not the account exists.
  return {
    ok: true,
    message: "If an account exists for that email, we've sent a link to reset your password. It expires in 1 hour.",
  };
}

export async function updatePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: str(form, "password"),
    confirmPassword: str(form, "confirmPassword"),
  });
  if (!parsed.success) return { errors: issuesByField(parsed.error) };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { message: "Your reset link has expired. Please request a new one." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { errors: { password: "Choose a password you haven't used before." } };
    return { message: "We couldn't update your password. Please request a new reset link." };
  }
  redirect("/account?updated=password");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?signedOut=1");
}
