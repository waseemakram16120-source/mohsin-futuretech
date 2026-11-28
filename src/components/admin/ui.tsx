import Link from "next/link";
import type { ReactNode } from "react";
import { PAYMENT_METHOD_LABELS } from "@/config/store";
import { Badge } from "@/components/ui/Badge";
import { formatPkPhone } from "@/lib/checkout/phone";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus, type PaymentStatus } from "@/lib/domain";
import { formatPrice } from "@/lib/format";
import type { AdminOrderRow } from "@/lib/admin/orders";
import { cn } from "@/lib/cn";

export const adminDate = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

export function AdminPageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone = status === "pending" ? "warning" : status === "delivered" ? "success" : status === "cancelled" || status === "returned" ? "neutral" : "dark";
  return <Badge tone={tone}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone = status === "pending_verification" || status === "rejected" ? "warning" : status === "approved" || status === "paid" ? "success" : "neutral";
  return <Badge tone={tone}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function StatCard({ label, value, hint, href, tone = "neutral" }: { label: string; value: string; hint?: string; href?: string; tone?: "neutral" | "warning" }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className={cn("mt-2 font-display text-2xl tabular-nums sm:text-3xl", tone === "warning" && "text-warning")}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </>
  );
  const cls = "block rounded-card border border-stone bg-surface p-4 sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-ink")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Orders as a table on wide screens and as cards on phones. */
export function AdminOrderTable({ rows }: { rows: AdminOrderRow[] }) {
  return (
    <div className="overflow-hidden rounded-card border border-stone bg-surface">
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="border-b border-stone bg-sand/40 text-xs uppercase tracking-[0.08em] text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Order</th>
            <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 font-semibold">Payment</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone">
          {rows.map((o) => (
            <tr key={o.id} className="hover:bg-sand/40" data-testid="admin-order-row">
              <td className="px-4 py-3">
                <Link href={`/admin/orders/${o.order_number}`} className="font-mono font-semibold underline-offset-4 hover:underline">
                  {o.order_number}
                </Link>
                <p className="text-xs text-muted">{adminDate.format(new Date(o.created_at))}</p>
              </td>
              <td className="px-4 py-3">
                <p>{o.delivery_name}</p>
                <p className="text-xs text-muted">
                  {formatPkPhone(o.delivery_phone)} · {o.city}
                </p>
              </td>
              <td className="px-4 py-3">
                <OrderStatusBadge status={o.status} />
              </td>
              <td className="px-4 py-3">
                <PaymentStatusBadge status={o.payment_status} />
                <p className="mt-1 text-xs text-muted">{PAYMENT_METHOD_LABELS[o.payment_method]}</p>
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPrice(o.total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-stone md:hidden">
        {rows.map((o) => (
          <li key={o.id} data-testid="admin-order-card">
            <Link href={`/admin/orders/${o.order_number}`} className="block p-4 hover:bg-sand/40">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-sm font-semibold">{o.order_number}</span>
                <span className="text-sm font-semibold tabular-nums">{formatPrice(o.total_amount)}</span>
              </div>
              <p className="mt-1 text-sm">
                {o.delivery_name} · {o.city}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <OrderStatusBadge status={o.status} />
                <PaymentStatusBadge status={o.payment_status} />
                <span className="text-xs text-muted">{PAYMENT_METHOD_LABELS[o.payment_method]}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
