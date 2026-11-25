/**
 * /admin — dashboard summary (PDF §5).
 * Live mode loads /api/admin/overview; demo mode computes the same
 * summary from local demo orders + seed catalogue.
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminGet } from "@/lib/admin-client";
import { getDemoOverview } from "@/lib/admin-data";
import type { AdminOverview } from "@/lib/admin-types";
import { formatPKR } from "@/lib/constants";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  OrderStatusBadge,
  PageTitle,
  StatCard,
} from "@/components/admin-ui";

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminGet("/api/admin/overview")
      .then((json) => {
        if (json.mode === "live" && json.overview) {
          setMode("live");
          setOverview(json.overview as AdminOverview);
        } else {
          setMode("demo");
          setOverview(getDemoOverview());
        }
      })
      .catch(() => {
        // API unreachable — demo fallback still shows local data.
        setMode("demo");
        setOverview(getDemoOverview());
      });
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!overview) return <LoadingState label="Loading dashboard…" />;

  return (
    <div>
      <PageTitle
        title="Dashboard"
        subtitle={
          mode === "demo"
            ? "Demo data — place a test order on the storefront to see it here."
            : "Live store summary."
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total orders" value={String(overview.totalOrders)} />
        <StatCard
          label="Total sales"
          value={formatPKR(overview.totalRevenue)}
          sub={`Today: ${formatPKR(overview.todayRevenue)} (${overview.todayOrders} orders)`}
        />
        <StatCard label="Customers" value={String(overview.totalCustomers)} />
        <StatCard label="Products" value={String(overview.totalProducts)} />
        <StatCard
          label="Pending orders"
          value={String(overview.pendingOrders)}
          sub="Awaiting review"
        />
        <StatCard
          label="Pending payments"
          value={String(overview.pendingPayments)}
          sub="EasyPaisa / JazzCash awaiting verification"
        />
        <StatCard
          label="Low stock"
          value={String(overview.lowStockCount)}
          sub="Variants with 5 or fewer left"
        />
        <StatCard
          label="Today's orders"
          value={String(overview.todayOrders)}
          sub={formatPKR(overview.todayRevenue)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-[#0f2440]">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm text-sky-700 underline">
              View all
            </Link>
          </div>
          {overview.recentOrders.length === 0 ? (
            <EmptyState message="No orders yet. Place a test order on the storefront to see it here." />
          ) : (
            <ul className="divide-y">
              {overview.recentOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium text-sky-700">
                    {o.orderNumber}
                  </Link>
                  <span className="text-zinc-600">{o.customerName}</span>
                  <span className="font-semibold">{formatPKR(o.totalAmount)}</span>
                  <OrderStatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-[#0f2440]">Low stock alerts</h2>
            <Link href="/admin/inventory" className="text-sm text-sky-700 underline">
              Manage inventory
            </Link>
          </div>
          {overview.lowStockVariants.length === 0 ? (
            <EmptyState message="No low-stock variants. All variants have more than 5 in stock." />
          ) : (
            <ul className="divide-y">
              {overview.lowStockVariants.map((v) => (
                <li key={v.sku} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {v.productName} — {v.size} / {v.color}
                    <span className="block text-xs text-zinc-500">{v.sku}</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      v.stock === 0
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {v.stock === 0 ? "Out of stock" : `${v.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {overview.pendingPayments > 0 && (
            <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-800">
              {overview.pendingPayments} payment(s) waiting for verification.{" "}
              <Link href="/admin/payments" className="font-semibold underline">
                Review payments
              </Link>
            </p>
          )}
        </section>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Pending orders need review: confirm the order, verify the payment if
        EasyPaisa / JazzCash, then move it to Processing → Shipped → Delivered.
      </p>
    </div>
  );
}
