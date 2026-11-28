"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { niceTicks, periodLabel } from "@/lib/admin/report-range";

export interface ChartPoint {
  period: string;
  sales: number;
  orders: number;
  collected: number;
}

const compact = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${+(n / 1000).toFixed(0)}K` : n.toLocaleString("en-PK"));

/**
 * Single-series column chart of sales per day/month. Hover, tap or use the
 * arrow keys to read each period; the table below the chart has every value.
 */
export function SalesChart({ points, group, title }: { points: ChartPoint[]; group: "day" | "month"; title: string }) {
  const uid = useId();
  const [active, setActive] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(0, ...points.map((p) => p.sales)));
  const top = ticks.at(-1)!;
  const every = Math.max(1, Math.ceil(points.length / 8)); // ≤ 8 x-labels
  const current = active === null ? null : points[active];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!points.length) return;
    const last = points.length - 1;
    const next =
      e.key === "ArrowRight" ? Math.min(last, (active ?? -1) + 1)
      : e.key === "ArrowLeft" ? Math.max(0, (active ?? last + 1) - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : e.key === "Escape" ? null
      : undefined;
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
  };

  return (
    <figure className="rounded-card border border-stone bg-surface p-4 sm:p-6" aria-labelledby={`${uid}-title`} data-testid="sales-chart">
      <figcaption id={`${uid}-title`} className="text-sm font-semibold">
        {title}
      </figcaption>
      <p className="mt-0.5 text-xs text-muted">Hover, tap or use the arrow keys for details. Every value is in the table below.</p>

      <div className="mt-5 flex gap-3">
        {/* y-axis */}
        <div className="relative w-12 shrink-0 text-right text-[0.6875rem] tabular-nums text-muted" aria-hidden="true" style={{ height: 220 }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {compact(t)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="relative outline-offset-4"
            style={{ height: 220 }}
            role="application"
            aria-roledescription="chart"
            aria-label={`${title}. Use left and right arrow keys to read each ${group}.`}
            tabIndex={0}
            onKeyDown={onKey}
            onBlur={() => setActive(null)}
            onMouseLeave={() => setActive(null)}
          >
            {ticks.map((t) => (
              <div key={t} aria-hidden="true" className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-stone-strong" : "bg-stone")} style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end">
              {points.map((p, i) => (
                <div
                  key={p.period}
                  className="relative flex h-full flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                  data-testid="chart-band"
                >
                  <div
                    className={cn("w-[70%] max-w-6 rounded-t-[4px] bg-chart transition-opacity", active !== null && active !== i && "opacity-40")}
                    style={{ height: p.sales > 0 ? `max(2px, ${(p.sales / top) * 100}%)` : 0 }}
                  />
                </div>
              ))}
            </div>
            {current && active !== null ? (
              <div
                role="status"
                className="pointer-events-none absolute top-0 z-10 w-max max-w-56 -translate-x-1/2 rounded-card border border-stone bg-surface px-3 py-2 text-xs shadow-lg"
                style={{ left: `clamp(4.5rem, ${((active + 0.5) / points.length) * 100}%, calc(100% - 4.5rem))` }}
                data-testid="chart-tooltip"
              >
                <p className="font-semibold">{periodLabel(current.period, group)}</p>
                <p className="mt-1 flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-chart" aria-hidden="true" />
                  Sales <span className="ml-auto pl-3 font-semibold tabular-nums">{formatPrice(current.sales)}</span>
                </p>
                <p className="flex justify-between gap-3 text-ink-soft">
                  Orders <span className="tabular-nums">{current.orders}</span>
                </p>
                <p className="flex justify-between gap-3 text-ink-soft">
                  Received <span className="tabular-nums">{formatPrice(current.collected)}</span>
                </p>
              </div>
            ) : null}
          </div>
          {/* x-axis: labels centred on their column, never truncated; half of them on phones. */}
          <div className="relative mt-2 h-4 text-[0.6875rem] text-muted" aria-hidden="true">
            {points.map((p, i) =>
              i % every === 0 ? (
                <span
                  key={p.period}
                  className={cn("absolute -translate-x-1/2 whitespace-nowrap", (i / every) % 2 === 1 && "hidden sm:inline")}
                  style={{ left: `${((i + 0.5) / points.length) * 100}%` }}
                >
                  {periodLabel(p.period, group, true)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </figure>
  );
}
