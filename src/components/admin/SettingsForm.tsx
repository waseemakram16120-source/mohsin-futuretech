"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";
import { saveSettings, type CatalogResult } from "@/app/admin/catalog-actions";
import { FormMessage, inputClasses } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import type { RawSettings } from "@/lib/admin/catalog";
import { cn } from "@/lib/cn";

type Key =
  | "storeName" | "supportPhone" | "supportEmail" | "whatsapp" | "storeAddress" | "deliveryCharge" | "freeDeliveryMin"
  | "lowStockThreshold" | "easypaisaName" | "easypaisaNumber" | "jazzcashName" | "jazzcashNumber";

export function SettingsForm({ settings }: { settings: RawSettings }) {
  const router = useRouter();
  const uid = useId();
  const [v, setV] = useState<Record<Key, string>>({
    storeName: settings.store_name,
    supportPhone: settings.support_phone ?? "",
    supportEmail: settings.support_email ?? "",
    whatsapp: settings.whatsapp_number ? `0${settings.whatsapp_number.slice(2)}` : "",
    storeAddress: settings.store_address ?? "",
    deliveryCharge: String(settings.delivery_charge),
    freeDeliveryMin: String(settings.free_delivery_min),
    lowStockThreshold: String(settings.low_stock_threshold),
    easypaisaName: settings.easypaisa_account_name ?? "",
    easypaisaNumber: settings.easypaisa_account_number ?? "",
    jazzcashName: settings.jazzcash_account_name ?? "",
    jazzcashNumber: settings.jazzcash_account_number ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [pending, start] = useTransition();

  const field = (k: Key, label: string, opts: { hint?: string; inputMode?: "decimal" | "numeric" | "tel" | "email" } = {}) => (
    <div>
      <label htmlFor={`${uid}-${k}`} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={`${uid}-${k}`}
        value={v[k]}
        inputMode={opts.inputMode}
        onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))}
        aria-invalid={Boolean(errors[k])}
        aria-describedby={errors[k] ? `${uid}-${k}-err` : opts.hint ? `${uid}-${k}-hint` : undefined}
        className={cn(inputClasses(Boolean(errors[k])), "mt-1.5")}
      />
      {errors[k] ? (
        <p id={`${uid}-${k}-err`} className="mt-1 text-sm text-sale">
          {errors[k]}
        </p>
      ) : opts.hint ? (
        <p id={`${uid}-${k}-hint`} className="mt-1 text-xs text-muted">
          {opts.hint}
        </p>
      ) : null}
    </div>
  );
  const box = (title: string, children: ReactNode, intro?: string) => (
    <section className="rounded-card border border-stone bg-surface p-5 sm:p-6" aria-label={title}>
      <h2 className="font-display text-xl">{title}</h2>
      {intro ? <p className="mt-1 text-sm text-ink-soft">{intro}</p> : null}
      <div className="mt-4 grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );

  return (
    <form
      noValidate
      aria-label="Store settings"
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSettings(v);
          setErrors(r.errors ?? {});
          setResult(r);
          if (r.ok) router.refresh();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }}
    >
      {result ? <FormMessage tone={result.ok ? "success" : "error"} testId="settings-message">{result.message}</FormMessage> : null}
      {box(
        "Store & contact",
        <>
          {field("storeName", "Store name")}
          {field("whatsapp", "WhatsApp number", { hint: "Used for the chat button, e.g. 0300 1234567.", inputMode: "tel" })}
          {field("supportPhone", "Phone shown in the footer", { inputMode: "tel" })}
          {field("supportEmail", "Support email", { inputMode: "email" })}
          <div className="sm:col-span-2">{field("storeAddress", "Shop address")}</div>
        </>,
      )}
      {box(
        "Delivery & stock",
        <>
          {field("deliveryCharge", "Delivery charge (Rs)", { inputMode: "decimal" })}
          {field("freeDeliveryMin", "Free delivery from (Rs)", { hint: "Order total after discount. 0 = always free.", inputMode: "decimal" })}
          {field("lowStockThreshold", "Low-stock warning at", { hint: "Variants with this many or fewer show as low stock.", inputMode: "numeric" })}
        </>,
      )}
      {box(
        "EasyPaisa & JazzCash accounts",
        <>
          {field("easypaisaName", "EasyPaisa account name")}
          {field("easypaisaNumber", "EasyPaisa account number", { inputMode: "tel" })}
          {field("jazzcashName", "JazzCash account name")}
          {field("jazzcashNumber", "JazzCash account number", { inputMode: "tel" })}
        </>,
        "Customers send money to these accounts and upload their receipt. A wallet is offered at checkout only when both its name and number are filled in. Double-check the numbers — customers pay exactly what is shown here.",
      )}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-stone bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
