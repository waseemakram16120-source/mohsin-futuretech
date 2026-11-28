import type { Metadata } from "next";
import Link from "next/link";
import { AdminOrderTable, AdminPageHeader, StatCard } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/States";
import { requireAdmin } from "@/lib/admin/auth";
import { adminOverview, recentOrders } from "@/lib/admin/orders";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const admin = await requireAdmin("/admin");
  const [o, recent] = await Promise.all([adminOverview(), recentOrders(8)]);
  const n = (v: number) => v.toLocaleString("en-PK");
  return (
    <div>
      <AdminPageHeader title="Dashboard" description={`Signed in as ${admin.name}.`} />

      {o.payments_to_verify > 0 || o.orders_pending > 0 || o.cod_to_collect > 0 || o.chats_waiting > 0 ? (
        <section aria-labelledby="todo" className="mb-8 rounded-card border border-warning/30 bg-warning-soft p-4 text-sm text-warning sm:p-5">
          <h2 id="todo" className="font-semibold">
            Needs your attention
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {o.chats_waiting > 0 ? (
              <li>
                <Link href="/admin/messages" className="underline">
                  {o.chats_waiting} chat{o.chats_waiting === 1 ? "" : "s"} waiting for a reply
                </Link>
              </li>
            ) : null}
            {o.payments_to_verify > 0 ? (
              <li>
                <Link href="/admin/payments" className="underline">
                  {o.payments_to_verify} payment{o.payments_to_verify === 1 ? "" : "s"} waiting for verification
                </Link>
              </li>
            ) : null}
            {o.orders_pending > 0 ? (
              <li>
                <Link href="/admin/orders?status=pending" className="underline">
                  {o.orders_pending} order{o.orders_pending === 1 ? "" : "s"} waiting to be confirmed
                </Link>
              </li>
            ) : null}
            {o.cod_to_collect > 0 ? (
              <li>
                <Link href="/admin/payments#cod" className="underline">
                  {o.cod_to_collect} delivered COD order{o.cod_to_collect === 1 ? "" : "s"} to mark as paid
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" data-testid="admin-stats">
        <StatCard label="Orders" value={n(o.orders_total)} hint={`${n(o.orders_today)} today`} href="/admin/orders" />
        <StatCard label="Sales" value={formatPrice(o.sales_total)} hint={`${formatPrice(o.sales_today)} today · excl. cancelled/returned`} />
        <StatCard label="Payments received" value={formatPrice(o.revenue_collected)} hint="Approved or paid" />
        <StatCard label="Pending orders" value={n(o.orders_pending)} hint={`${n(o.orders_to_ship)} confirmed / processing`} href="/admin/orders?status=pending" tone={o.orders_pending ? "warning" : "neutral"} />
        <StatCard label="To verify" value={n(o.payments_to_verify)} hint="EasyPaisa / JazzCash" href="/admin/payments" tone={o.payments_to_verify ? "warning" : "neutral"} />
        <StatCard label="Customers" value={n(o.customers)} hint="Registered accounts" />
        <StatCard label="Products" value={n(o.products_active)} hint="Active in the shop" />
        <StatCard label="Low stock" value={n(o.low_stock)} hint={`≤ ${o.low_stock_threshold} left · ${n(o.out_of_stock)} sold out`} tone={o.low_stock ? "warning" : "neutral"} />
      </div>

      <section aria-labelledby="recent" className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="recent" className="font-display text-2xl">
            Recent orders
          </h2>
          <span className="flex gap-4 text-sm">
            <Link href="/admin/reports" className="underline underline-offset-4">
              Sales reports
            </Link>
            <Link href="/admin/orders" className="underline underline-offset-4">
              All orders
            </Link>
          </span>
        </div>
        {recent.length ? <AdminOrderTable rows={recent} /> : <EmptyState icon="bag" title="No orders yet" />}
      </section>
    </div>
  );
}
