/**
 * /admin/reports — sales summaries (PDF §5): daily/monthly summaries,
 * order counts, revenue summaries, pending orders, best-selling
 * products. Live via API, demo computed from local orders.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { adminGet } from "@/lib/admin-client";
import { getDemoReport } from "@/lib/admin-data";
import type { AdminReport } from "@/lib/admin-types";
import { formatPKR } from "@/lib/constants";
import { LoadingState, PageTitle, StatCard } from "@/components/admin-ui";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

export default function AdminReportsPage() {
  const [range, setRange] = useState("30d");
  const [report, setReport] = useState<AdminReport | null>(null);

  const load = useCallback((r: string) => {
    adminGet(`/api/admin/reports?range=${r}`)
      .then((json) => {
        if (json.mode === "live" && json.report) {
          setReport(json.report as AdminReport);
        } else {
          setReport(getDemoReport(r));
        }
      })
      .catch(() => setReport(getDemoReport(r)));
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  if (!report) return <LoadingState label="Loading reports…" />;

  return (
    <div>
      <PageTitle
        title="Reports"
        subtitle="Sales summaries, order counts and best-selling products."
        action={
          <div className="flex gap-1 rounded-lg border bg-white p-1 shadow-sm">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  range === r.value ? "bg-[#0f2440] text-white" : "text-zinc-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Orders" value={String(report.orderCount)} />
        <StatCard label="Revenue" value={formatPKR(report.revenue)} />
        <StatCard label="Avg. order value" value={formatPKR(report.averageOrderValue)} />
        <StatCard label="Pending orders" value={String(report.pendingOrders)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-[#0f2440]">Daily summary</h2>
          {report.daily.length === 0 ? (
            <p className="text-sm text-zinc-500">No orders in this range yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2">Date</th>
                  <th className="py-2 text-right">Orders</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.daily.slice(0, 14).map((d) => (
                  <tr key={d.date}>
                    <td className="py-2">{d.date}</td>
                    <td className="py-2 text-right">{d.orders}</td>
                    <td className="py-2 text-right font-semibold">{formatPKR(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-[#0f2440]">Monthly summary</h2>
          {report.monthly.length === 0 ? (
            <p className="text-sm text-zinc-500">No orders in this range yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2">Month</th>
                  <th className="py-2 text-right">Orders</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.monthly.map((m) => (
                  <tr key={m.month}>
                    <td className="py-2">{m.month}</td>
                    <td className="py-2 text-right">{m.orders}</td>
                    <td className="py-2 text-right font-semibold">{formatPKR(m.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-[#0f2440]">Best-selling products</h2>
        {report.bestSellers.length === 0 ? (
          <p className="text-sm text-zinc-500">No sales in this range yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr>
                <th className="py-2">Product</th>
                <th className="py-2">SKU</th>
                <th className="py-2 text-right">Qty sold</th>
                <th className="py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.bestSellers.slice(0, 10).map((b) => (
                <tr key={b.sku ?? b.productName}>
                  <td className="py-2 font-medium">{b.productName}</td>
                  <td className="py-2 font-mono text-xs">{b.sku ?? "—"}</td>
                  <td className="py-2 text-right">{b.quantity}</td>
                  <td className="py-2 text-right font-semibold">{formatPKR(b.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
