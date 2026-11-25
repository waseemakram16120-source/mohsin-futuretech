/**
 * Customer sign-up (Step 3) — Supabase Auth (email + password + name).
 * The profile row is auto-created by the handle_new_user() trigger in
 * supabase/schema.sql. Shows a clear notice when Supabase is not set up.
 */
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where to return after sign-up + login (e.g. /checkout when signing up
  // from checkout) — carried through to the login page.
  const next = searchParams.get("next");
  const loginHref = next
    ? `/login?next=${encodeURIComponent(next)}`
    : "/login";
  const { configured } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (fullName.trim().length < 3) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.includes("@") || password.length < 6) {
      setError("Enter a valid email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    const { error: authError } = await createClient().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setDone(true);
  }

  if (!configured) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-zinc-900">Create Account</h1>
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Customer accounts are not available yet — the store database (Supabase)
          is not connected. You can still shop as a guest and track orders with
          your order number on the{" "}
          <Link href="/track" className="font-bold underline">Track Order</Link> page.
        </p>
        <Link href="/shop" className="mt-6 inline-block rounded-full bg-[#0f2440] px-6 py-3 text-sm font-bold text-white">
          Continue Shopping
        </Link>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <p className="text-5xl">✓</p>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Account created!</h1>
        <p className="mt-2 text-zinc-600">
          If email confirmation is enabled for this store, please check your inbox
          and confirm your email. Otherwise you can log in right away.
        </p>
        <button
          type="button"
          onClick={() => router.push(loginHref)}
          className="mt-6 rounded-full bg-[#0f2440] px-8 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c]"
        >
          Go to Login
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Create Your Account</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Save addresses, track orders and check out faster.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="full-name" className="text-sm font-semibold text-zinc-900">Full name *</label>
          <input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-[#0f2440]" placeholder="e.g. Ahmed Raza" />
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-semibold text-zinc-900">Email *</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-[#0f2440]" placeholder="you@example.com" />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-semibold text-zinc-900">Password *</label>
          <div className="relative mt-1">
            <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 pr-16 text-sm outline-none focus:border-[#0f2440]" placeholder="At least 6 characters" />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-bold text-[#0f2440] hover:bg-zinc-100">
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
        )}
        <button type="submit" disabled={busy} className="w-full rounded-full bg-[#0f2440] px-6 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c] disabled:bg-zinc-300">
          {busy ? "Creating your account…" : "Create Account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href={loginHref} className="font-semibold text-[#0f2440] hover:underline">Login</Link>
      </p>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-16"><p className="text-zinc-600">Loading…</p></main>}>
      <SignupForm />
    </Suspense>
  );
}
