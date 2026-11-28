import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, adminDate } from "@/components/admin/ui";
import { inputClasses } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { requireAdmin } from "@/lib/admin/auth";
import { listCustomers } from "@/lib/admin/catalog";
import { formatPkPhone } from "@/lib/checkout/phone";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Customers" };

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function AdminCustomersPage({ searchParams }: Props) {
  await requireAdmin("/admin/customers");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) || undefined : undefined;
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const { rows, total, pageSize } = await listCustomers({ q, page });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;
  return (
    <div>
      <AdminPageHeader title="Customers" description={`${total} registered customer${total === 1 ? "" : "s"}${q ? " match" : ""}. Guest orders are listed under Orders.`} />
      <form method="get" role="search" aria-label="Search customers" className="mb-6 flex gap-2">
        <label htmlFor="c-q" className="sr-only">
          Name, email or phone
        </label>
        <input id="c-q" name="q" defaultValue={q} placeholder="Name, email or phone" className={cn(inputClasses(false), "max-w-sm")} />
        <Button type="submit" className="h-12">
          Search
        </Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState icon="user" title={q ? "No customers match" : "No customers yet"} />
      ) : (
        <ul className="divide-y divide-stone rounded-card border border-stone bg-surface" data-testid="customer-list">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/customers/${c.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4 hover:bg-sand/40" data-testid="customer-row">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium">{c.fullName || "—"}</p>
                  <p className="text-sm text-ink-soft">
                    {c.email}
                    {c.phone ? ` · ${formatPkPhone(c.phone)}` : ""}
                  </p>
                </div>
                <div className="text-sm">
                  <p>
                    {c.ordersCount} order{c.ordersCount === 1 ? "" : "s"} · {formatPrice(c.totalSpent)}
                  </p>
                  <p className="text-xs text-muted">{c.lastOrderAt ? `Last order ${adminDate.format(new Date(c.lastOrderAt))}` : `Joined ${adminDate.format(new Date(c.createdAt))}`}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href(page - 1)} className="underline">← Previous</Link> : <span />}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href(page + 1)} className="underline">Next →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
