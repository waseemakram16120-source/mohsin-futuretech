import Link from "next/link";
import { PAYMENT_METHOD_LABELS } from "@/config/store";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/domain";
import { formatPrice } from "@/lib/format";
import type { OrderSummaryRow } from "@/lib/orders/account";

const dateFmt = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: "Asia/Karachi" });

export function OrderList({ orders }: { orders: OrderSummaryRow[] }) {
  return (
    <ul className="divide-y divide-stone rounded-card border border-stone bg-surface" data-testid="order-list">
      {orders.map((o) => {
        const needsPayment = o.paymentStatus === "awaiting_payment" || o.paymentStatus === "rejected";
        return (
          <li key={o.orderNumber}>
            <Link
              href={`/orders/${o.orderNumber}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-sand/60 sm:p-5"
              data-testid="order-row"
            >
              <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                <p className="font-mono text-sm font-semibold">{o.orderNumber}</p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {dateFmt.format(new Date(o.createdAt))} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"} ·{" "}
                  {PAYMENT_METHOD_LABELS[o.paymentMethod]}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={o.status === "delivered" ? "success" : o.status === "cancelled" || o.status === "returned" ? "neutral" : "dark"}>
                  {ORDER_STATUS_LABELS[o.status]}
                </Badge>
                <Badge tone={needsPayment ? "warning" : o.paymentStatus === "pending_verification" ? "warning" : "neutral"}>
                  {PAYMENT_STATUS_LABELS[o.paymentStatus]}
                </Badge>
              </div>
              <p className="ml-auto text-right text-sm font-semibold tabular-nums sm:ml-0 sm:w-24">{formatPrice(o.total)}</p>
              <Icon name="chevronRight" className="hidden size-4 text-muted sm:block" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
