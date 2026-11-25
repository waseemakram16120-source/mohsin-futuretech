/**
 * Customer login (Step 3) — Supabase Auth (email + password).
 * Shows a clear notice when Supabase is not configured yet.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.includes("@") || password.length < 6) {
      setError("Enter your email and password (at least 6 characters).");
      return;
    }
    setBusy(true);
    const { error: authError } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.push(searchParams.get("next") ?? "/account");
    router.refresh();
  }

  if (!configured) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-zinc-900">Login</h1>
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

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Login to Your Account</h1>
      <p className="mt-1 text-sm text-zinc-600">
        See your orders, saved addresses and wishlist.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-semibold text-zinc-900">Email *</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-[#0f2440]" placeholder="you@example.com" />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-semibold text-zinc-900">Password *</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-[#0f2440]" placeholder="Your password" />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
        )}
        <button type="submit" disabled={busy} className="w-full rounded-full bg-[#0f2440] px-6 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c] disabled:bg-zinc-300">
          {busy ? "Logging in…" : "Login"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-600">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-[#0f2440] hover:underline">Sign up</Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-16"><p className="text-zinc-600">Loading…</p></main>}>
      <LoginForm />
    </Suspense>
  );
}
