/**
 * Admin shell (Step 5) — sidebar navigation, top bar, access guard and
 * demo-mode banner.
 *
 * Access rule: when Supabase is NOT configured, anyone opening /admin
 * gets clearly-labelled Demo Admin mode (local data only). When Supabase
 * IS configured, only a signed-in user whose profile role is 'admin'
 * may enter — others are sent to /login or shown access denied. The
 * /api/admin/* routes enforce the same check server-side.
 */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { STORE_NAME } from "@/lib/constants";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/reports", label: "Reports" },
];

/**
 * Sidebar nav — uses usePathname() for the active item, so it lives in
 * its own component wrapped in <Suspense> (Next 16 blocks prerendering
 * of usePathname() outside Suspense).
 */
function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto rounded-lg bg-white p-2 shadow-sm sm:w-48 sm:flex-col">
      {NAV.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded px-3 py-2 text-sm font-medium ${
              active
                ? "bg-[#0f2440] text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminNavFallback() {
  return (
    <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto rounded-lg bg-white p-2 shadow-sm sm:w-48 sm:flex-col">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="whitespace-nowrap rounded px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { configured, user, profile, loading, signOut } = useAuth();

  const demoMode = !configured;
  const isAdmin = demoMode || profile?.role === "admin";

  useEffect(() => {
    if (!loading && configured && !user) {
      router.replace("/login?next=/admin");
    }
  }, [loading, configured, user, router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-zinc-500">
        Loading admin dashboard…
      </main>
    );
  }

  if (configured && !user) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center">
        <p className="text-sm text-zinc-500">
          Please sign in to access the admin dashboard.
        </p>
        <Link
          href="/login?next=/admin"
          className="mt-4 inline-block rounded bg-[#0f2440] px-4 py-2 text-sm font-medium text-white"
        >
          Sign in
        </Link>
      </main>
    );
  }

  if (configured && user && !isAdmin) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[#0f2440]">Access denied</h1>
        <p className="mt-2 text-sm text-zinc-500">
          This area is for store admins only. Your account ({user.email}) does
          not have admin access.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded bg-[#0f2440] px-4 py-2 text-sm font-medium text-white"
        >
          Back to store
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="bg-[#0f2440] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href="/admin" className="text-lg font-bold">
            {STORE_NAME} <span className="font-normal text-zinc-300">Admin</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {demoMode ? (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950">
                Demo Admin
              </span>
            ) : (
              <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-semibold text-emerald-950">
                {profile?.email ?? user?.email ?? "Admin"}
              </span>
            )}
            <Link href="/" className="underline underline-offset-2">
              View store
            </Link>
            {!demoMode && (
              <button
                type="button"
                onClick={() => void signOut()}
                className="underline underline-offset-2"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      {demoMode && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm">
          Demo mode — connect Supabase for live data. Orders, products and
          payments shown here are stored in this browser only.
        </div>
      )}

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row">
        <Suspense fallback={<AdminNavFallback />}>
          <AdminNav />
        </Suspense>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
