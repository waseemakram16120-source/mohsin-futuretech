/**
 * /admin/customers/[id] — customer detail: profile + order history.
 */
"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { adminGet } from "@/lib/admin-client";
import { getDemoAdminCustomers, getDemoAdminOrders } from "@/lib/admin-data";
import type { AdminCustomer, AdminOrder } from "@/lib/admin-types";
import { formatPKR } from "@/lib/constants";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  OrderStatusBadge,
  PageTitle,
} from "@/components/admin-ui";

export default function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    adminGet(`/api/admin/customers/${id}`)
      .then((json) => {
        if (json.mode === "live" && json.customer) {
          setCustomer(json.customer as AdminCustomer);
          setOrders((json.orders as AdminOrder[]) ?? []);
        } else {
          const found = getDemoAdminCustomers().find((c) => c.id === id) ?? null;
          setCustomer(found);
          if (found) {
            setOrders(
              getDemoAdminOrders().filter((o) => o.phone === found.phone),
            );
          } else {
            setNotFound(true);
          }
        }
      })
      .catch(() => {
        const found = getDemoAdminCustomers().find((c) => c.id === id) ?? null;
        setCustomer(found);
        if (found) {
          setOrders(getDemoAdminOrders().filter((o) => o.phone === found.phone));
        } else {
          setNotFound(true);
        }
      });
  }, [id]);

  if (notFound) return <ErrorState message="Customer not found." />;
  if (!customer || !orders) return <LoadingState label="Loading customer…" />;

  return (
    <div>
      <PageTitle
        title={customer.fullName}
        subtitle={customer.email}
        action={<Link href="/admin/customers" className="text-sm text-sky-700 underline">← All customers</Link>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-zinc-500">Phone</p>
          <p className="mt-1 font-semibold">{customer.phone ?? "—"}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-zinc-500">Orders</p>
          <p className="mt-1 font-semibold">{customer.orderCount}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-zinc-500">Total spent</p>
          <p className="mt-1 font-semibold">{formatPKR(customer.totalSpent)}</p>
        </div>
      </div>

      <h2 className="mb-2 font-semibold text-[#0f2440]">Order history</h2>
      {orders.length === 0 ? (
        <EmptyState message="No orders for this customer yet." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-sky-700">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{new Date(o.createdAt).toLocaleDateString("en-PK")}</td>
                  <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPKR(o.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
