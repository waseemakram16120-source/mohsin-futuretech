/**
 * Reset password — reached from the link in the Supabase reset email
 * (via /auth/confirm, which signs the user in first).
 *
 * If the page loads with a `code` in the URL (email linked here directly),
 * it is exchanged for a session on the client. Without a valid recovery
 * session the form is not shown — the link may have expired, and the user
 * is sent back to /forgot-password for a fresh one.
 */
"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { configured } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function prepare() {
      const supabase = createClient();
      const code = searchParams.get("code");
      if (code) {
        // Email linked straight here instead of via /auth/confirm.
        await supabase.auth.exchangeCodeForSession(code);
      }
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));
      setChecking(false);
    }
    void prepare();
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Your new password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  }

  if (!configured) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-zinc-900">Reset Password</h1>
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Customer accounts are not available yet — the store database (Supabase)
          is not connected.
        </p>
        <Link href="/shop" className="mt-6 inline-block rounded-full bg-[#0f2440] px-6 py-3 text-sm font-bold text-white">
          Continue Shopping
        </Link>
      </main>
    );
  }

  if (checking) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <p className="text-zinc-600">Checking your reset link…</p>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <p className="text-5xl">⏰</p>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Link expired or invalid</h1>
        <p className="mt-2 text-zinc-600">
          This password-reset link is no longer valid. Links expire after
          1 hour and can only be used once — request a fresh one below.
        </p>
        <Link href="/forgot-password" className="mt-6 inline-block rounded-full bg-[#0f2440] px-8 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c]">
          Request a New Link
        </Link>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <p className="text-5xl">✓</p>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Password updated!</h1>
        <p className="mt-2 text-zinc-600">
          Your password has been changed. Log in with your new password.
        </p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="mt-6 rounded-full bg-[#0f2440] px-8 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c]"
        >
          Go to Login
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Set a New Password</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Choose a strong password you don&apos;t use anywhere else.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="password" className="text-sm font-semibold text-zinc-900">New password *</label>
          <div className="relative mt-1">
            <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 pr-16 text-sm outline-none focus:border-[#0f2440]" placeholder="At least 6 characters" />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-bold text-[#0f2440] hover:bg-zinc-100">
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="confirm-password" className="text-sm font-semibold text-zinc-900">Confirm new password *</label>
          <div className="relative mt-1">
            <input id="confirm-password" type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 pr-16 text-sm outline-none focus:border-[#0f2440]" placeholder="Type it again" />
            <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-bold text-[#0f2440] hover:bg-zinc-100">
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
        )}
        <button type="submit" disabled={busy} className="w-full rounded-full bg-[#0f2440] px-6 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c] disabled:bg-zinc-300">
          {busy ? "Updating…" : "Update Password"}
        </button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-16"><p className="text-zinc-600">Loading…</p></main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
