import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminNav, type AdminNavItem } from "@/components/admin/AdminNav";
import { isAdminUser } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

async function badges() {
  const supabase = await createClient();
  const [verify, pending] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "pending_verification"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return { verify: verify.count ?? 0, pending: pending.count ?? 0 };
}

/**
 * Admin shell. Each page calls requireAdmin() with its own path (sign-in
 * redirect / access denied); the shell only renders for admins.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await isAdminUser())) return children;
  const counts = await badges();
  const items: AdminNavItem[] = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/orders", label: "Orders", badge: counts.pending },
    { href: "/admin/payments", label: "Payments", badge: counts.verify },
  ];
  return (
    <div className="container-page py-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[13rem_1fr] lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Store admin</p>
          <AdminNav items={items} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
