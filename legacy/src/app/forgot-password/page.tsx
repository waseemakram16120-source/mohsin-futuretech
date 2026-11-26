/**
 * Forgot password — sends a Supabase password-reset email.
 *
 * The email links back to /auth/confirm (which exchanges the code for a
 * session) and then to /reset-password. The message is deliberately
 * generic: Supabase returns success even for unknown emails, so we never
 * reveal whether an address has an account.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

export default function ForgotPasswordPage() {
  const { configured } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    const { error: authError } = await createClient().auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      },
    );
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
        <h1 className="text-2xl font-bold text-zinc-900">Forgot Password</h1>
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
        <p className="text-5xl">✉️</p>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Check your inbox</h1>
        <p className="mt-2 text-zinc-600">
          If an account exists for {email.trim()}, a password-reset link is on
          its way. The link expires in 1 hour — check your spam folder if you
          don&apos;t see it.
        </p>
        <Link href="/login" className="mt-6 inline-block rounded-full bg-[#0f2440] px-8 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c]">
          Back to Login
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Forgot Password</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Enter the email you signed up with and we&apos;ll send you a link to
        reset your password.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-semibold text-zinc-900">Email *</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-[#0f2440]" placeholder="you@example.com" />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
        )}
        <button type="submit" disabled={busy} className="w-full rounded-full bg-[#0f2440] px-6 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c] disabled:bg-zinc-300">
          {busy ? "Sending…" : "Send Reset Link"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-600">
        Remembered your password?{" "}
        <Link href="/login" className="font-semibold text-[#0f2440] hover:underline">Login</Link>
      </p>
    </main>
  );
}
