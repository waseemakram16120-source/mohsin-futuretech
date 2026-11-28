"use client";

import { useId, useRef } from "react";
import type { SizeChart } from "@/config/size-guide";
import { Icon } from "@/components/ui/Icon";

export function SizeChartTable({ chart, caption = true }: { chart: SizeChart; caption?: boolean }) {
  return (
    // Scrolls sideways on very narrow phones; focusable so keyboards can scroll it too.
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${chart.title} size chart`}>
      <table className="w-full min-w-[20rem] border-collapse text-sm">
        {caption ? <caption className="mb-3 text-left font-semibold">{chart.title} (inches)</caption> : null}
        <thead>
          <tr className="border-b border-stone-strong">
            {chart.columns.map((col) => (
              <th key={col} scope="col" className="px-3 py-2.5 text-left font-semibold first:pl-0">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((row) => (
            <tr key={row[0]} className="border-b border-stone">
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="px-3 py-2.5 pl-0 text-left font-semibold">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className="px-3 py-2.5 tabular-nums text-ink-soft">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-relaxed text-muted">{chart.note}</p>
    </div>
  );
}

/** "Size guide" link that opens the chart in a native modal <dialog>. */
export function SizeGuideButton({ chart }: { chart: SizeChart }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex min-h-9 items-center gap-1 text-sm font-medium underline underline-offset-4 hover:text-accent"
        aria-haspopup="dialog"
      >
        Size guide
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-card bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between border-b border-stone px-5 py-3">
          <h2 id={titleId} className="font-display text-xl">
            Size guide
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="inline-flex size-11 items-center justify-center rounded-xs hover:bg-sand"
            aria-label="Close size guide"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>
        <div className="p-5">
          <SizeChartTable chart={chart} />
        </div>
      </dialog>
    </>
  );
}
