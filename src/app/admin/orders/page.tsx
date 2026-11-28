import type { Metadata } from "next";
import Link from "next/link";
import { AdminOrderTable, AdminPageHeader } from "@/components/admin/ui";
import { inputClasses } from "@/components/forms/Field";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/config/store";
import { requireAdmin } from "@/lib/admin/auth";
import { listOrders, orderFiltersSchema } from "@/lib/admin/orders";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, PAYMENT_STATUSES, PAYMENT_STATUS_LABELS } from "@/lib/domain";

export const metadata: Metadata = { title: "Orders" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminOrdersPage({ searchParams }: Props) {
  await requireAdmin("/admin/orders");
  const raw = await searchParams;
  const one = (k: string) => (typeof raw[k] === "string" && raw[k] !== "" ? (raw[k] as string) : undefined);
  const filters = orderFiltersSchema.parse({ q: one("q"), status: one("status"), payment: one("payment"), method: one("method"), page: one("page") });
  const { rows, total, page, pageSize } = await listOrders(filters);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(filters.q || filters.status || filters.payment || filters.method);
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    for (const k of ["q", "status", "payment", "method"] as const) if (filters[k]) sp.set(k, String(filters[k]));
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `/admin/orders${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <AdminPageHeader title="Orders" description={`${total.toLocaleString("en-PK")} order${total === 1 ? "" : "s"}${filtered ? " match your filters" : ""}.`} />

      <form method="get" className="mb-6 grid gap-3 rounded-card border border-stone bg-surface p-4 sm:grid-cols-2 xl:grid-cols-[1fr_repeat(3,11rem)_auto]" role="search" aria-label="Filter orders">
        <div>
          <label htmlFor="f-q" className="text-xs font-medium text-ink-soft">
            Search
          </label>
          <input id="f-q" name="q" defaultValue={filters.q} placeholder="Order number, name or phone" className={inputClasses(false)} />
        </div>
        <div>
          <label htmlFor="f-status" className="text-xs font-medium text-ink-soft">
            Order status
          </label>
          <select id="f-status" name="status" defaultValue={filters.status ?? ""} className={inputClasses(false)}>
            <option value="">All</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-payment" className="text-xs font-medium text-ink-soft">
            Payment status
          </label>
          <select id="f-payment" name="payment" defaultValue={filters.payment ?? ""} className={inputClasses(false)}>
            <option value="">All</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-method" className="text-xs font-medium text-ink-soft">
            Method
          </label>
          <select id="f-method" name="method" defaultValue={filters.method ?? ""} className={inputClasses(false)}>
            <option value="">All</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" className="h-12">
            Apply
          </Button>
          {filtered ? (
            <ButtonLink href="/admin/orders" variant="ghost" className="h-12">
              Clear
            </ButtonLink>
          ) : null}
        </div>
      </form>

      {rows.length ? (
        <AdminOrderTable rows={rows} />
      ) : (
        <EmptyState icon="bag" title={filtered ? "No orders match" : "No orders yet"} description={filtered ? "Try a different search or clear the filters." : undefined} />
      )}

      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="underline underline-offset-4" rel="prev">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="underline underline-offset-4" rel="next">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
