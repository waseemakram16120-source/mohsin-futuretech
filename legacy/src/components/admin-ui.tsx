/**
 * Shared admin UI bits (Step 5) — stat cards, status badges, page titles.
 * Navy #0f2440 branding to match the storefront.
 */
import { formatPKR } from "@/lib/constants";
import { ORDER_STATUSES, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-xl font-bold text-[#0f2440] sm:text-2xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-[#0f2440]">{value}</p>
      {sub ? <p className="mt-1 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

export function formatMoney(value: number): string {
  return formatPKR(value);
}

const ORDER_BADGE: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  processing: "bg-violet-100 text-violet-800",
  shipped: "bg-blue-100 text-blue-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-zinc-200 text-zinc-700",
};

const PAYMENT_BADGE: Record<PaymentStatus, string> = {
  pending_verification: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  due: "bg-sky-100 text-sky-800",
  paid: "bg-emerald-100 text-emerald-800",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const label =
    ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ORDER_BADGE[status]}`}
    >
      {label}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${PAYMENT_BADGE[status]}`}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}

export function LoadingState({ label }: { label: string }) {
  return <p className="py-10 text-center text-sm text-zinc-500">{label}</p>;
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {message}
    </p>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border bg-white p-6 text-center text-sm text-zinc-500 shadow-sm">
      {message}
    </p>
  );
}
