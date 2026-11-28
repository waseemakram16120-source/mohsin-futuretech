"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { adjustStock } from "@/app/admin/catalog-actions";
import { inputClasses } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const REASONS = ["New stock received", "Damaged / faulty", "Stock count correction", "Returned to supplier"];

/** + / − stock change with a reason; recorded in the stock history. */
export function StockAdjuster({ variantId, sku }: { variantId: string; sku: string }) {
  const router = useRouter();
  const uid = useId();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const apply = (sign: 1 | -1) => {
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) {
      setMessage({ ok: false, text: "Enter a whole number." });
      return;
    }
    start(async () => {
      const r = await adjustStock({ variantId, change: sign * n, note: reason });
      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) {
        setAmount("");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="stock-adjuster">
      <label htmlFor={`${uid}-qty`} className="sr-only">
        Quantity for {sku}
      </label>
      <input id={`${uid}-qty`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Qty" className={cn(inputClasses(false), "h-10 w-20")} />
      <label htmlFor={`${uid}-reason`} className="sr-only">
        Reason for {sku}
      </label>
      <select id={`${uid}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} className={cn(inputClasses(false), "h-10 w-auto")}>
        {REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <Button size="sm" disabled={pending} onClick={() => apply(1)} aria-label={`Add stock to ${sku}`}>
        + Add
      </Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => apply(-1)} aria-label={`Remove stock from ${sku}`}>
        − Remove
      </Button>
      {message ? (
        <span role={message.ok ? "status" : "alert"} className={cn("text-xs", message.ok ? "text-success" : "text-sale")}>
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
