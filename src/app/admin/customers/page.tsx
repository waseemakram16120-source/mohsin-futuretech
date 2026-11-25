/**
 * /admin/customers — customer management (PDF §5): contacts, profiles
 * and order history. Live via API, demo derived from demo orders.
 */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { adminGet } from "@/lib/admin-client";
import { getDemoAdminCustomers } from "@/lib/admin-data";
import type { AdminCustomer } from "@/lib/admin-types";
import { formatPKR } from "@/lib/constants";
import {
  EmptyState,
  LoadingState,
  PageTitle,
} from "@/components/admin-ui";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    adminGet("/api/admin/customers")
      .then((json) => {
        if (json.mode === "live" && Array.isArray(json.customers)) {
          setCustomers(json.customers as AdminCustomer[]);
        } else {
          setCustomers(getDemoAdminCustomers());
        }
      })
      .catch(() => setCustomers(getDemoAdminCustomers()));
  }, []);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.fullName, c.email, c.phone ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [customers, query]);

  if (!customers) return <LoadingState label="Loading customers…" />;

  return (
    <div>
      <PageTitle title="Customers" subtitle={`${filtered.length} of ${customers.length} customers`} />

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, email or phone…"
        className="mb-4 w-full max-w-md rounded border bg-white px-3 py-2 text-sm"
      />

      {filtered.length === 0 ? (
        <EmptyState message="No customers yet. Customers appear here after their first order or sign-up." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3 text-right">Total spent</th>
                <th className="px-4 py-3">Last order</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-sky-700">
                      {c.fullName}
                    </Link>
                    {c.role === "admin" && (
                      <span className="ml-2 rounded-full bg-[#0f2440] px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.email}
                    <span className="block text-xs text-zinc-500">{c.phone ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{c.orderCount}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPKR(c.totalSpent)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("en-PK") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
