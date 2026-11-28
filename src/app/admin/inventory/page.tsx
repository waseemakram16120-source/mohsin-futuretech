import type { Metadata } from "next";
import Link from "next/link";
import { StockAdjuster } from "@/components/admin/StockAdjuster";
import { AdminPageHeader, adminDate } from "@/components/admin/ui";
import { inputClasses } from "@/components/forms/Field";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { requireAdmin } from "@/lib/admin/auth";
import { listInventory, recentMovements } from "@/lib/admin/catalog";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Inventory" };

const REASON_LABEL: Record<string, string> = { initial: "Opening stock", order: "Order", cancel: "Order cancelled", return: "Order returned", adjustment: "Adjustment" };

type Props = { searchParams: Promise<{ q?: string; level?: string }> };

export default async function AdminInventoryPage({ searchParams }: Props) {
  await requireAdmin("/admin/inventory");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : undefined;
  const level = sp.level === "low" || sp.level === "out" ? sp.level : undefined;
  const [{ rows, threshold }, movements] = await Promise.all([listInventory({ q, level }), recentMovements(30)]);
  const tab = (l?: string) =>
    cn("rounded-xs px-3 py-2 text-sm font-medium", (l ?? "") === (level ?? "") ? "bg-ink text-surface" : "text-ink-soft hover:bg-sand");
  const qs = (l?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (l) p.set("level", l);
    const s = p.toString();
    return `/admin/inventory${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <AdminPageHeader title="Inventory" description={`Stock per size and colour. Low stock = ${threshold} or fewer (change in Settings).`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <nav aria-label="Stock level" className="flex gap-1">
          <Link href={qs()} className={tab()} aria-current={!level ? "page" : undefined}>
            All
          </Link>
          <Link href={qs("low")} className={tab("low")} aria-current={level === "low" ? "page" : undefined}>
            Low stock
          </Link>
          <Link href={qs("out")} className={tab("out")} aria-current={level === "out" ? "page" : undefined}>
            Sold out
          </Link>
        </nav>
        <form method="get" role="search" aria-label="Search inventory" className="ml-auto flex gap-2">
          {level ? <input type="hidden" name="level" value={level} /> : null}
          <label htmlFor="inv-q" className="sr-only">
            Search SKU or product
          </label>
          <input id="inv-q" name="q" defaultValue={q} placeholder="SKU or product" className={cn(inputClasses(false), "h-10 w-48")} />
          <Button type="submit" size="sm" className="h-10">
            Search
          </Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="box" title={level ? "Nothing here" : "No variants"} description={level === "low" ? "No variant is low on stock." : undefined} />
      ) : (
        <ul className="divide-y divide-stone rounded-card border border-stone bg-surface" data-testid="inventory-list">
          {rows.map((r) => (
            <li key={r.variantId} className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4" data-testid="inventory-row">
              <div className="min-w-0 flex-1 basis-60">
                <Link href={`/admin/products/${r.productId}`} className="font-medium underline-offset-4 hover:underline">
                  {r.productName}
                </Link>
                <p className="text-sm text-ink-soft">
                  {r.color} · Size {r.size} · <span className="font-mono text-xs">{r.sku}</span>
                </p>
                {!r.productActive ? <Badge>Archived product</Badge> : null}
              </div>
              <div className="w-24 text-right">
                <p className={cn("text-2xl font-semibold tabular-nums", r.stock === 0 ? "text-sale" : r.stock <= threshold ? "text-warning" : "")} data-testid="stock-qty">
                  {r.stock}
                </p>
                <p className="text-xs text-muted">{r.stock === 0 ? "Sold out" : r.stock <= threshold ? "Low stock" : "In stock"}</p>
              </div>
              <StockAdjuster variantId={r.variantId} sku={r.sku} />
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="history" className="mt-10">
        <h2 id="history" className="font-display text-2xl">
          Recent stock changes
        </h2>
        <ul className="mt-4 divide-y divide-stone rounded-card border border-stone bg-surface text-sm" data-testid="stock-history">
          {movements.map((m) => (
            <li key={m.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
              <span className={cn("w-12 font-semibold tabular-nums", m.change > 0 ? "text-success" : "text-sale")}>
                {m.change > 0 ? `+${m.change}` : m.change}
              </span>
              <span className="min-w-0 flex-1">
                {m.productName} <span className="font-mono text-xs text-muted">{m.sku}</span>
              </span>
              <span className="text-ink-soft">
                {REASON_LABEL[m.reason] ?? m.reason}
                {m.note && m.reason === "adjustment" ? ` — ${m.note}` : ""}
                {m.orderNumber ? (
                  <>
                    {" "}
                    <Link href={`/admin/orders/${m.orderNumber}`} className="font-mono underline">
                      {m.orderNumber}
                    </Link>
                  </>
                ) : null}
              </span>
              <span className="text-xs text-muted">
                {adminDate.format(new Date(m.createdAt))}
                {m.actor ? ` · ${m.actor}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
