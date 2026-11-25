/**
 * Order status timeline (Step 3).
 *
 * Shows the proposal workflow: Pending → Confirmed → Processing →
 * Shipped → Delivered. Cancelled / Returned are end states shown instead
 * of the forward flow when the order is in one of them.
 */
import { ORDER_STATUSES } from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";

const FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

export default function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled" || status === "returned") {
    const info = ORDER_STATUSES.find((s) => s.value === status);
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="font-bold text-red-800">{info?.label}</p>
        <p className="mt-1 text-sm text-red-700">{info?.description}</p>
      </div>
    );
  }

  const currentIndex = FLOW.indexOf(status);
  return (
    <ol className="space-y-0">
      {FLOW.map((step, index) => {
        const info = ORDER_STATUSES.find((s) => s.value === step)!;
        const done = index < currentIndex;
        const current = index === currentIndex;
        return (
          <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
            {index < FLOW.length - 1 && (
              <span
                aria-hidden
                className={`absolute top-6 left-[11px] h-full w-0.5 ${
                  done ? "bg-emerald-500" : "bg-zinc-200"
                }`}
              />
            )}
            <span
              className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                done
                  ? "bg-emerald-500"
                  : current
                    ? "bg-[#0f2440]"
                    : "bg-zinc-300"
              }`}
            >
              {done ? "✓" : index + 1}
            </span>
            <div>
              <p
                className={`text-sm font-bold ${
                  done || current ? "text-zinc-900" : "text-zinc-400"
                }`}
              >
                {info.label}
                {current && (
                  <span className="ml-2 rounded-full bg-[#0f2440] px-2 py-0.5 text-[11px] font-bold text-white">
                    Current
                  </span>
                )}
              </p>
              <p className="text-xs text-zinc-500">{info.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
