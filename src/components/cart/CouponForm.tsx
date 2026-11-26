"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { couponCodeSchema } from "@/lib/checkout/schema";
import { setCouponCode } from "@/lib/stores/coupon";
import type { Quote } from "@/lib/orders/quote";

export function CouponForm({ coupon, loading }: { coupon: Quote["coupon"]; loading: boolean }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = couponCodeSchema.safeParse(value);
    if (!parsed.success || !parsed.data) {
      setLocalError(parsed.success ? "Enter a coupon code." : parsed.error.issues[0].message);
      return;
    }
    setLocalError(null);
    setCouponCode(parsed.data);
  };

  if (coupon?.valid) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-sm">
        <p className="flex items-center gap-2 font-medium text-success" role="status">
          <Icon name="shield" className="size-4" /> {coupon.message}
        </p>
        <button type="button" className="font-medium underline underline-offset-4" onClick={() => setCouponCode(null)}>
          Remove
        </button>
      </div>
    );
  }

  const error = localError ?? (coupon && !coupon.valid ? coupon.message : null);
  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor={id} className="text-sm font-semibold">
        Coupon code
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          autoComplete="off"
          maxLength={30}
          placeholder="e.g. WELCOME10"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-11 min-w-0 flex-1 rounded-xs border border-stone-strong bg-surface px-3 text-sm uppercase placeholder:normal-case"
        />
        <Button type="submit" variant="secondary" className="h-11" disabled={loading}>
          Apply
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-sale">
          {error}
          {coupon && !coupon.valid ? (
            <button type="button" className="ml-2 underline underline-offset-4" onClick={() => setCouponCode(null)}>
              Clear
            </button>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
