import type { Metadata } from "next";
import Link from "next/link";
import { SalesChart } from "@/components/admin/SalesChart";
import { AdminPageHeader, StatCard } from "@/components/admin/ui";
import { inputClasses } from "@/components/forms/Field";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { PAYMENT_METHOD_LABELS } from "@/config/store";
import { requireAdmin } from "@/lib/admin/auth";
import { RANGE_LABELS, RANGE_PRESETS, karachiToday, periodLabel, resolveRange } from "@/lib/admin/report-range";
import { getReport } from "@/lib/admin/reports";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminReportsPage({ searchParams }: Props) {
  await requireAdmin("/admin/reports");
  const raw = await searchParams;
  const one = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  const range = resolveRange({ range: one("range"), from: one("from"), to: one("to"), group: one("group") });
  const report = await getReport(range);
  const s = report.summary;
  const n = (v: number) => v.toLocaleString("en-PK");

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base = { range: range.preset, ...(range.preset === "custom" ? { from: range.from, to: range.to } : {}), group: one("group"), ...over };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return p.toString();
  };
  const pill = (activeNow: boolean) =>
    cn("inline-flex h-10 items-center rounded-xs px-3 text-sm font-medium", activeNow ? "bg-ink text-surface" : "text-ink-soft hover:bg-sand hover:text-ink");
  const hasData = s.orders > 0;
  const maxQty = Math.max(1, ...report.best_sellers.map((b) => b.qty));
  const methodTotal = report.by_method.reduce((a, m) => a + m.sales, 0) || 1;

  return (
    <div>
      <AdminPageHeader
        title="Reports"
        description={`${range.label} · ${range.from === range.to ? range.from : `${range.from} to ${range.to}`} (Pakistan time)`}
        actions={
          <ButtonLink href={`/admin/reports/export?${qs({})}`} variant="secondary" prefetch={false} download>
            Download CSV
          </ButtonLink>
        }
      />

      {/* Filters: one row above the charts. */}
      <div className="mb-6 space-y-3 rounded-card border border-stone bg-surface p-4">
        <nav aria-label="Date range" className="flex flex-wrap gap-1">
          {RANGE_PRESETS.map((p) => (
            <Link key={p} href={`/admin/reports?${qs({ range: p, from: undefined, to: undefined })}`} className={pill(range.preset === p)} aria-current={range.preset === p ? "page" : undefined}>
              {RANGE_LABELS[p]}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-end gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2" aria-label="Custom dates">
            <input type="hidden" name="range" value="custom" />
            <div>
              <label htmlFor="r-from" className="text-xs font-medium text-ink-soft">
                From
              </label>
              <input id="r-from" name="from" type="date" defaultValue={range.from} max={karachiToday()} className={cn(inputClasses(false), "h-10")} />
            </div>
            <div>
              <label htmlFor="r-to" className="text-xs font-medium text-ink-soft">
                To
              </label>
              <input id="r-to" name="to" type="date" defaultValue={range.to} max={karachiToday()} className={cn(inputClasses(false), "h-10")} />
            </div>
            <Button type="submit" size="sm" className="h-10">
              Show
            </Button>
          </form>
          <nav aria-label="Group by" className="ml-auto flex gap-1">
            <Link href={`/admin/reports?${qs({ group: "day" })}`} className={pill(range.group === "day")} aria-current={range.group === "day" ? "page" : undefined}>
              Daily
            </Link>
            <Link href={`/admin/reports?${qs({ group: "month" })}`} className={pill(range.group === "month")} aria-current={range.group === "month" ? "page" : undefined}>
              Monthly
            </Link>
          </nav>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" data-testid="report-stats">
        <StatCard label="Sales" value={formatPrice(s.sales)} hint={`${n(s.valid_orders)} orders · excl. cancelled/returned`} />
        <StatCard label="Payments received" value={formatPrice(s.collected)} hint="Approved or paid" />
        <StatCard label="Orders placed" value={n(s.orders)} hint={`${n(s.cancelled)} cancelled · ${n(s.returned)} returned`} />
        <StatCard label="Average order" value={formatPrice(s.avg_order_value)} hint={`${n(s.items_sold)} items · ${n(s.customers)} customers`} />
      </div>

      <section aria-labelledby="now" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 rounded-card border border-stone bg-surface px-4 py-3 text-sm">
        <h2 id="now" className="font-semibold">
          Right now
        </h2>
        <Link href="/admin/orders?status=pending" className="underline underline-offset-4">
          {n(report.now.pending_orders)} pending orders
        </Link>
        <span>{n(report.now.to_ship)} confirmed / processing</span>
        <Link href="/admin/payments" className="underline underline-offset-4">
          {n(report.now.payments_to_verify)} payments to verify
        </Link>
      </section>

      {!hasData ? (
        <div className="mt-8">
          <EmptyState icon="bag" title="No orders in this period" description="Pick a longer range to see sales." />
        </div>
      ) : (
        <>
          <div className="mt-8">
            <SalesChart
              title={`Sales by ${range.group === "month" ? "month" : "day"} (Rs)`}
              group={range.group}
              points={report.series.map((p) => ({ period: p.period, sales: p.sales, orders: p.valid_orders, collected: p.collected }))}
            />
          </div>

          <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_24rem]">
            <section aria-labelledby="period-table">
              <h2 id="period-table" className="mb-3 font-display text-2xl">
                {range.group === "month" ? "Monthly" : "Daily"} summary
              </h2>
              <div className="max-h-[32rem] overflow-auto rounded-card border border-stone bg-surface" tabIndex={0} role="region" aria-labelledby="period-table">
                <table className="w-full text-sm" data-testid="period-table">
                  <thead className="sticky top-0 bg-sand text-left text-xs uppercase tracking-[0.08em] text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-semibold">{range.group === "month" ? "Month" : "Day"}</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-semibold">Orders</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-semibold">Sales</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-semibold">Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone tabular-nums">
                    {[...report.series].reverse().map((p) => (
                      <tr key={p.period} className={p.orders === 0 ? "text-muted" : undefined}>
                        <th scope="row" className="whitespace-nowrap px-4 py-2 text-left font-normal">{periodLabel(p.period, range.group)}</th>
                        <td className="px-4 py-2 text-right">{p.valid_orders}</td>
                        <td className="px-4 py-2 text-right">{formatPrice(p.sales)}</td>
                        <td className="px-4 py-2 text-right">{formatPrice(p.collected)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-stone-strong font-semibold tabular-nums">
                    <tr>
                      <th scope="row" className="px-4 py-2.5 text-left">Total</th>
                      <td className="px-4 py-2.5 text-right">{s.valid_orders}</td>
                      <td className="px-4 py-2.5 text-right">{formatPrice(s.sales)}</td>
                      <td className="px-4 py-2.5 text-right">{formatPrice(s.collected)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <div className="space-y-8">
              <section aria-labelledby="best">
                <h2 id="best" className="mb-3 font-display text-2xl">
                  Best sellers
                </h2>
                {report.best_sellers.length ? (
                  <ol className="space-y-3 rounded-card border border-stone bg-surface p-4" data-testid="best-sellers">
                    {report.best_sellers.map((b, i) => (
                      <li key={`${b.product_id ?? b.name}-${i}`} className="text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate">
                            <span className="mr-2 text-muted tabular-nums">{i + 1}.</span>
                            {b.product_id ? (
                              <Link href={`/admin/products/${b.product_id}`} className="underline-offset-4 hover:underline">
                                {b.name}
                              </Link>
                            ) : (
                              b.name
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            <strong>{b.qty}</strong> sold · {formatPrice(b.revenue)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-sand" aria-hidden="true">
                          <div className="h-2 rounded-full bg-chart" style={{ width: `${(b.qty / maxQty) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-ink-soft">No items sold in this period.</p>
                )}
              </section>

              <section aria-labelledby="methods">
                <h2 id="methods" className="mb-3 font-display text-2xl">
                  Payment methods
                </h2>
                <ul className="space-y-3 rounded-card border border-stone bg-surface p-4 text-sm" data-testid="by-method">
                  {report.by_method.map((m) => (
                    <li key={m.method}>
                      <div className="flex justify-between gap-3">
                        <span>{PAYMENT_METHOD_LABELS[m.method]}</span>
                        <span className="tabular-nums">
                          {m.orders} · {formatPrice(m.sales)} · {Math.round((m.sales / methodTotal) * 100)}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-sand" aria-hidden="true">
                        <div className="h-2 rounded-full bg-chart" style={{ width: `${(m.sales / methodTotal) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="money" className="rounded-card border border-stone bg-surface p-4 text-sm">
                <h2 id="money" className="font-semibold">
                  Included in sales
                </h2>
                <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 tabular-nums">
                  <dt className="text-ink-soft">Delivery charges</dt>
                  <dd>{formatPrice(s.delivery_charges)}</dd>
                  <dt className="text-ink-soft">Discounts given</dt>
                  <dd>{s.discounts > 0 ? `−${formatPrice(s.discounts)}` : formatPrice(0)}</dd>
                </dl>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
