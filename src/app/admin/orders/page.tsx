/**
 * /admin/orders — order management (PDF §5): search by order number /
 * customer / phone, filter by order status, payment status and payment
 * method, sort by date or total. Live via API, demo via local orders.
 */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { adminGet } from "@/lib/admin-client";
import { getDemoAdminOrders } from "@/lib/admin-data";
import type { AdminOrder } from "@/lib/admin-types";
import { formatPKR, ORDER_STATUSES } from "@/lib/constants";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/types";
import {
  EmptyState,
  LoadingState,
  OrderStatusBadge,
  PageTitle,
  PaymentStatusBadge,
} from "@/components/admin-ui";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "all">("all");
  const [method, setMethod] = useState<PaymentMethod | "all">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "total-desc" | "total-asc">("newest");

  useEffect(() => {
    adminGet("/api/admin/orders")
      .then((json) => {
        if (json.mode === "live" && Array.isArray(json.orders)) {
          setOrders(json.orders as AdminOrder[]);
        } else {
          setOrders(getDemoAdminOrders());
        }
      })
      .catch(() => setOrders(getDemoAdminOrders()));
  }, []);

  const filtered = useMemo(() => {
    if (!orders) return [];
    const q = query.trim().toLowerCase();
    const list = orders.filter((o) => {
      if (q && ![o.orderNumber, o.customerName, o.phone].join(" ").toLowerCase().includes(q)) {
        return false;
      }
      if (status !== "all" && o.status !== status) return false;
      if (paymentStatus !== "all" && o.paymentStatus !== paymentStatus) return false;
      if (method !== "all" && o.paymentMethod !== method) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "total-desc") return b.totalAmount - a.totalAmount;
      return a.totalAmount - b.totalAmount;
    });
  }, [orders, query, status, paymentStatus, method, sort]);

  if (!orders) return <LoadingState label="Loading orders…" />;

  return (
    <div>
      <PageTitle
        title="Orders"
        subtitle={`${filtered.length} of ${orders.length} orders`}
      />

      <div className="mb-4 grid gap-2 rounded-lg border bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search order no., name or phone…"
          className="rounded border px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | "all")}
          className="rounded border px-3 py-2 text-sm"
          aria-label="Order status"
        >
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus | "all")}
          className="rounded border px-3 py-2 text-sm"
          aria-label="Payment status"
        >
          <option value="all">All payments</option>
          <option value="pending_verification">Pending Verification</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="due">Due on Delivery</option>
          <option value="paid">Paid</option>
        </select>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod | "all")}
          className="rounded border px-3 py-2 text-sm"
          aria-label="Payment method"
        >
          <option value="all">All methods</option>
          <option value="cod">Cash on Delivery</option>
          <option value="easypaisa">EasyPaisa</option>
          <option value="jazzcash">JazzCash</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded border px-3 py-2 text-sm"
          aria-label="Sort orders"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="total-desc">Total: high to low</option>
          <option value="total-asc">Total: low to high</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No orders match these filters." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-sky-700">
                      {o.orderNumber}
                    </Link>
                    <span className="block text-xs text-zinc-500">
                      {new Date(o.createdAt).toLocaleString("en-PK")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {o.customerName}
                    <span className="block text-xs text-zinc-500">{o.phone}</span>
                  </td>
                  <td className="px-4 py-3">
                    <PaymentStatusBadge status={o.paymentStatus} />
                    <span className="block text-xs capitalize text-zinc-500">
                      {o.paymentMethod === "cod" ? "COD" : o.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatPKR(o.totalAmount)}
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
