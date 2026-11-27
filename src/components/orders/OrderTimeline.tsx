import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/domain";

const FLOW: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];
const HELP: Record<OrderStatus, string> = {
  pending: "Order received, awaiting review.",
  confirmed: "Accepted by the store.",
  processing: "Items being prepared and packed.",
  shipped: "Dispatched to you.",
  delivered: "Received.",
  cancelled: "This order was cancelled.",
  returned: "This order was returned.",
};

const fmt = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

/** Proposal §7 workflow as a vertical progress list. */
export function OrderTimeline({ status, history }: { status: OrderStatus; history: { to_status: OrderStatus; created_at: string }[] }) {
  const when = (s: OrderStatus) => history.filter((h) => h.to_status === s).at(-1)?.created_at;
  const closed = status === "cancelled" || status === "returned";
  // For a closed order, show the steps it actually reached, then the closing step.
  const reached = FLOW.filter((s) => when(s));
  const steps: OrderStatus[] = closed ? [...reached, status] : FLOW;
  const currentIndex = steps.indexOf(status);

  return (
    <ol className="space-y-0" aria-label="Order progress" data-testid="order-timeline">
      {steps.map((s, i) => {
        const done = i <= currentIndex;
        const current = i === currentIndex;
        const at = when(s);
        const last = i === steps.length - 1;
        return (
          <li key={s} className="relative flex gap-4 pb-6 last:pb-0" aria-current={current ? "step" : undefined}>
            {!last ? (
              <span aria-hidden="true" className={cn("absolute top-7 left-[0.8125rem] h-[calc(100%-1.5rem)] w-px", i < currentIndex ? "bg-ink" : "bg-stone-strong")} />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs",
                done ? (closed && current ? "border-sale bg-sale text-surface" : "border-ink bg-ink text-surface") : "border-stone-strong bg-surface text-muted",
              )}
            >
              {done ? <Icon name={closed && current ? "close" : "check"} className="size-3.5" /> : i + 1}
            </span>
            <div className="pt-0.5 text-sm">
              <p className={cn("font-medium", !done && "text-muted")}>
                {ORDER_STATUS_LABELS[s]}
                {current ? <span className="sr-only"> (current status)</span> : null}
              </p>
              <p className="text-ink-soft">{at ? fmt.format(new Date(at)) : HELP[s]}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
