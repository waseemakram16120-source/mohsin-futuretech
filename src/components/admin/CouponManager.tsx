"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { saveCoupon, type CatalogResult } from "@/app/admin/catalog-actions";
import { FormMessage, inputClasses } from "@/components/forms/Field";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CouponRow } from "@/lib/admin/catalog";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date(iso)) : "");
const show = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: "Asia/Karachi" }).format(new Date(iso)) : null);

function CouponForm({ coupon, onDone }: { coupon: CouponRow | null; onDone: (r: CatalogResult) => void }) {
  const uid = useId();
  const [v, setV] = useState({
    code: coupon?.code ?? "",
    description: coupon?.description ?? "",
    discountType: coupon?.discountType ?? "percentage",
    discountValue: coupon ? String(coupon.discountValue) : "",
    minOrderAmount: coupon ? String(coupon.minOrderAmount) : "0",
    maxUses: coupon?.maxUses ? String(coupon.maxUses) : "",
    validFrom: day(coupon?.validFrom ?? null),
    validUntil: day(coupon?.validUntil ?? null),
    isActive: coupon?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v, val: string | boolean) => setV((x) => ({ ...x, [k]: val }));
  const f = (k: keyof typeof v, label: string, props: React.ComponentProps<"input"> = {}) => (
    <div>
      <label htmlFor={`${uid}-${k}`} className="text-sm font-medium">
        {label}
      </label>
      <input id={`${uid}-${k}`} value={String(v[k])} onChange={(e) => set(k, e.target.value)} aria-invalid={Boolean(errors[k])} className={cn(inputClasses(Boolean(errors[k])), "mt-1.5")} {...props} />
      {errors[k] ? <p className="mt-1 text-sm text-sale">{errors[k]}</p> : null}
    </div>
  );
  return (
    <form
      noValidate
      aria-label={coupon ? `Edit ${coupon.code}` : "New coupon"}
      className="space-y-4 rounded-card border border-stone bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveCoupon({ id: coupon?.id ?? null, ...v });
          setErrors(r.errors ?? {});
          setMessage(r.ok ? null : r.message);
          if (r.ok) onDone(r);
        });
      }}
    >
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {f("code", "Code", { className: cn(inputClasses(Boolean(errors.code)), "mt-1.5 font-mono uppercase"), autoCapitalize: "characters" })}
        <div>
          <label htmlFor={`${uid}-type`} className="text-sm font-medium">
            Discount type
          </label>
          <select id={`${uid}-type`} value={v.discountType} onChange={(e) => set("discountType", e.target.value)} className={cn(inputClasses(false), "mt-1.5")}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed amount (Rs)</option>
          </select>
        </div>
        {f("discountValue", v.discountType === "percentage" ? "Discount (%)" : "Discount (Rs)", { inputMode: "decimal" })}
        {f("minOrderAmount", "Minimum order (Rs)", { inputMode: "decimal" })}
        {f("maxUses", "Max uses (empty = unlimited)", { inputMode: "numeric" })}
        {f("description", "Note (optional)")}
        {f("validFrom", "Starts (optional)", { type: "date" })}
        {f("validUntil", "Ends (optional)", { type: "date" })}
        <label className="flex items-end gap-2 pb-3 text-sm">
          <input type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} className="size-4 accent-ink" /> Active
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save coupon"}
        </Button>
        <Button variant="ghost" onClick={() => onDone({ ok: false, message: "" })}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function CouponManager({ coupons }: { coupons: CouponRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [notice, setNotice] = useState<CatalogResult | null>(null);
  const done = (r: CatalogResult) => {
    setEditing(null);
    if (r.message) setNotice(r);
    if (r.ok) router.refresh();
  };
  const STATE: Record<CouponRow["state"], { label: string; tone: "success" | "neutral" | "warning" }> = {
    active: { label: "Active", tone: "success" },
    off: { label: "Off", tone: "neutral" },
    scheduled: { label: "Scheduled", tone: "warning" },
    expired: { label: "Expired", tone: "neutral" },
    used_up: { label: "Used up", tone: "neutral" },
  };
  return (
    <div className="space-y-5">
      {notice?.message ? <FormMessage tone={notice.ok ? "success" : "error"} testId="coupon-notice">{notice.message}</FormMessage> : null}
      {editing === "new" ? <CouponForm coupon={null} onDone={done} /> : <Button onClick={() => setEditing("new")}>Add coupon</Button>}
      <ul className="space-y-3" data-testid="coupon-list">
        {coupons.map((c) =>
          editing === c.id ? (
            <li key={c.id}>
              <CouponForm coupon={c} onDone={done} />
            </li>
          ) : (
            <li key={c.id} className="flex flex-wrap items-center gap-4 rounded-card border border-stone bg-surface p-4" data-testid="coupon-row">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{c.code}</span>
                  <Badge tone={STATE[c.state].tone}>{STATE[c.state].label}</Badge>
                </p>
                <p className="text-sm text-ink-soft">
                  {c.discountType === "percentage" ? `${c.discountValue}% off` : `${formatPrice(c.discountValue)} off`}
                  {c.minOrderAmount > 0 ? ` · min ${formatPrice(c.minOrderAmount)}` : ""} · used {c.usedCount}
                  {c.maxUses !== null ? ` / ${c.maxUses}` : ""}
                  {show(c.validUntil) ? ` · until ${show(c.validUntil)}` : ""}
                </p>
              </div>
              <button type="button" className="text-sm underline underline-offset-4" onClick={() => setEditing(c.id)} aria-label={`Edit ${c.code}`}>
                Edit
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
