"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CartSkeleton } from "@/components/cart/CartView";
import { TotalsTable } from "@/components/cart/CartSummary";
import { useQuote } from "@/components/cart/useQuote";
import { ProductImage } from "@/components/product/ProductImage";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { PAYMENT_METHOD_LABELS, isGatewayMethod, type GatewayMethod, type PaymentMethod } from "@/config/store";
import { startPayment } from "@/components/payments/perform-action";
import { CITY_SUGGESTIONS, PROVINCES, customerSchema, fieldErrors, placeOrderSchema } from "@/lib/checkout/schema";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { clearCart } from "@/lib/stores/cart";
import { setCouponCode } from "@/lib/stores/coupon";

type Field = "name" | "phone" | "email" | "address" | "city" | "province" | "postalCode" | "notes";
type Values = Record<Field, string>;

const EMPTY: Values = { name: "", phone: "", email: "", address: "", city: "", province: "", postalCode: "", notes: "" };

const FIELD_LABELS: Record<Field | "paymentMethod", string> = {
  name: "Full name",
  phone: "Mobile number",
  email: "Email",
  address: "Delivery address",
  city: "City",
  province: "Province",
  postalCode: "Postal code",
  notes: "Order notes",
  paymentMethod: "Payment method",
};

const METHOD_HELP: Record<PaymentMethod, string> = {
  cod: "Pay in cash when your parcel arrives.",
  jazzcash: "Pay now on JazzCash's secure page with your JazzCash account.",
  easypaisa: "Pay now on Easypaisa's secure page with your Easypaisa account.",
};

const MANUAL_HELP: Record<GatewayMethod, string> = {
  jazzcash: "Send the amount to our JazzCash account, then upload your Transaction ID and receipt.",
  easypaisa: "Send the amount to our Easypaisa account, then upload your Transaction ID and receipt.",
};

function FieldShell({
  id,
  label,
  error,
  hint,
  optional,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional ? <span className="font-normal text-muted"> (optional)</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-sm text-sale">
          <Icon name="alert" className="size-3.5 shrink-0" /> {error}
        </p>
      ) : null}
    </div>
  );
}

const inputCls = (invalid: boolean) =>
  cn(
    "h-12 w-full rounded-xs border bg-surface px-3.5 text-base placeholder:text-muted sm:text-sm",
    invalid ? "border-sale" : "border-stone-strong focus:border-ink",
  );

export interface CheckoutAccount {
  name: string;
  phone: string;
  email: string;
  addresses: Array<{
    id: string;
    label: string;
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    province: string | null;
    postalCode: string | null;
    isDefault: boolean;
  }>;
}

type SavedAddress = CheckoutAccount["addresses"][number];

function valuesFromAccount(account: CheckoutAccount | null, address: SavedAddress | undefined): Values {
  if (!account) return EMPTY;
  return {
    ...EMPTY,
    name: address?.fullName ?? account.name,
    phone: address?.phone ?? account.phone,
    email: account.email,
    address: address ? [address.line1, address.line2].filter(Boolean).join(", ") : "",
    city: address?.city ?? "",
    province: address?.province ?? "",
    postalCode: address?.postalCode ?? "",
  };
}

export function CheckoutForm({
  methods,
  manualMethods = [],
  account = null,
}: {
  methods: PaymentMethod[];
  manualMethods?: GatewayMethod[];
  account?: CheckoutAccount | null;
}) {
  const router = useRouter();
  const { state, lines, coupon, hydrated, retry } = useQuote();
  const defaultAddress = account?.addresses.find((a) => a.isDefault) ?? account?.addresses[0];
  const [values, setValues] = useState<Values>(() => valuesFromAccount(account, defaultAddress));
  const [addressId, setAddressId] = useState<string>(defaultAddress?.id ?? "");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const id = (f: string) => `${uid}-${f}`;

  const quote = state.quote;
  const isManual = (m: PaymentMethod | ""): m is GatewayMethod => m !== "" && isGatewayMethod(m) && manualMethods.includes(m);
  const isOnline = (m: PaymentMethod | ""): m is GatewayMethod => m !== "" && isGatewayMethod(m) && !manualMethods.includes(m);
  if (!hydrated || (!quote && state.status === "loading")) return <CartSkeleton />;
  if (lines.length === 0) {
    return (
      <EmptyState
        icon="bag"
        title="Your bag is empty"
        description="Add something you love, then come back to check out."
        action={<ButtonLink href="/shop">Shop all products</ButtonLink>}
      />
    );
  }
  if (!quote) {
    return (
      <ErrorState
        title="We couldn't load your order"
        description={state.status === "error" ? state.message : undefined}
        action={<Button onClick={retry}>Try again</Button>}
      />
    );
  }

  const set = (field: Field, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
  };

  const validateField = (field: Field) => {
    const r = customerSchema.shape[field].safeParse(values[field]);
    setErrors((e) => ({ ...e, [field]: r.success ? "" : r.error.issues[0].message }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setServerError(null);

    const payload = {
      customer: values,
      items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      paymentMethod: method,
      couponCode: coupon ?? "",
    };
    const parsed = placeOrderSchema.safeParse(payload);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      const first = (Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>).find((f) => errs[f]);
      if (first) document.getElementById(id(first))?.focus();
      return;
    }
    if (quote.hasIssues) {
      setServerError("Some items in your bag changed. Please review your bag before placing the order.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 201) {
        clearCart();
        setCouponCode(null);
        if (isOnline(body.paymentMethod)) {
          // Straight to the provider's secure page; if that cannot start,
          // the order page offers "Pay now" with the reason.
          const started = await startPayment(body.orderNumber).catch(() => ({ ok: false as const }));
          if (started.ok) return; // keep the button disabled while leaving
        }
        router.push(`/orders/${body.orderNumber}?placed=1`);
        return; // keep the button disabled while navigating
      }
      if (body.fieldErrors) setErrors(body.fieldErrors);
      setServerError(body.error ?? "We couldn't place your order. Please try again.");
      if (res.status === 409) retry(); // refresh stock / coupon
      setSubmitting(false);
    } catch {
      setServerError("Network error — please check your connection and try again. You have not been charged.");
      setSubmitting(false);
    }
  };

  const errorList = (Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>).filter((f) => errors[f]);
  const describedBy = (f: Field, hint = false) =>
    errors[f] ? `${id(f)}-error` : hint ? `${id(f)}-hint` : undefined;

  const text = (f: Field, props: { autoComplete: string; inputMode?: "tel" | "email" | "numeric" | "text"; placeholder?: string; type?: string; list?: string }) => (
    <input
      id={id(f)}
      name={f}
      value={values[f]}
      onChange={(e) => set(f, e.target.value)}
      onBlur={() => values[f] && validateField(f)}
      aria-invalid={Boolean(errors[f])}
      aria-describedby={describedBy(f, f === "phone")}
      className={inputCls(Boolean(errors[f]))}
      {...props}
    />
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[1fr_26rem] lg:gap-14" aria-busy={submitting}>
      <div className="space-y-10">
        {errorList.length > 0 || serverError ? (
          <div role="alert" className="rounded-card border border-sale/30 bg-sale-soft p-4 text-sm">
            {serverError ? <p className="font-semibold text-sale">{serverError}</p> : null}
            {errorList.length > 0 ? (
              <>
                <p className="font-semibold text-sale">Please fix {errorList.length === 1 ? "this field" : `these ${errorList.length} fields`}:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {errorList.map((f) => (
                    <li key={f}>
                      <a href={`#${id(f)}`} className="underline underline-offset-2">
                        {FIELD_LABELS[f]}: {errors[f]}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {serverError && quote.hasIssues ? (
              <Link href="/cart" className="mt-2 inline-block font-medium underline">
                Review your bag
              </Link>
            ) : null}
          </div>
        ) : null}

        {quote.hasIssues ? (
          <div role="alert" className="rounded-card border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
            Some items in your bag changed (price or stock).{" "}
            <Link href="/cart" className="font-semibold underline">
              Review your bag
            </Link>{" "}
            before placing your order.
          </div>
        ) : null}

        {account ? (
          <p className="text-sm text-ink-soft" data-testid="checkout-account">
            Signed in as <strong className="text-ink">{account.email}</strong>. This order will appear in{" "}
            <Link href="/account/orders" className="underline underline-offset-4">
              your orders
            </Link>
            .
          </p>
        ) : (
          <p className="rounded-card border border-stone bg-surface p-4 text-sm text-ink-soft">
            Have an account?{" "}
            <Link href="/login?next=/checkout" className="font-medium text-ink underline underline-offset-4">
              Sign in
            </Link>{" "}
            to use your saved addresses — or continue as a guest.
          </p>
        )}

        {account && account.addresses.length > 0 ? (
          <fieldset>
            <legend className="font-display text-2xl">Saved addresses</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {account.addresses.map((a) => (
                <label
                  key={a.id}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-card border bg-surface p-4 text-sm",
                    addressId === a.id ? "border-ink ring-1 ring-ink" : "border-stone-strong hover:border-ink",
                  )}
                >
                  <input
                    type="radio"
                    name="savedAddress"
                    value={a.id}
                    checked={addressId === a.id}
                    onChange={() => {
                      setAddressId(a.id);
                      setValues((v) => ({ ...valuesFromAccount(account, a), notes: v.notes, email: v.email }));
                      setErrors({});
                    }}
                    className="mt-0.5 size-4.5 accent-ink"
                  />
                  <span>
                    <span className="block font-semibold">{a.label}</span>
                    <span className="mt-1 block leading-relaxed text-ink-soft">
                      {a.fullName} · {a.line1}, {a.city}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset>
          <legend className="font-display text-2xl">Contact</legend>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <FieldShell id={id("name")} label={FIELD_LABELS.name} error={errors.name} className="sm:col-span-2">
              {text("name", { autoComplete: "name", placeholder: "e.g. Ali Khan" })}
            </FieldShell>
            <FieldShell id={id("phone")} label={FIELD_LABELS.phone} error={errors.phone} hint="We'll call or WhatsApp this number about your delivery.">
              {text("phone", { autoComplete: "tel", inputMode: "tel", type: "tel", placeholder: "0300 1234567" })}
            </FieldShell>
            <FieldShell id={id("email")} label={FIELD_LABELS.email} error={errors.email} optional>
              {text("email", { autoComplete: "email", inputMode: "email", type: "email", placeholder: "you@example.com" })}
            </FieldShell>
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-display text-2xl">Delivery address</legend>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <FieldShell id={id("address")} label={FIELD_LABELS.address} error={errors.address} className="sm:col-span-2">
              <textarea
                id={id("address")}
                name="address"
                rows={3}
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
                onBlur={() => values.address && validateField("address")}
                autoComplete="street-address"
                placeholder="House no., street, area / block"
                aria-invalid={Boolean(errors.address)}
                aria-describedby={describedBy("address")}
                className={cn(inputCls(Boolean(errors.address)), "h-auto py-3")}
              />
            </FieldShell>
            <FieldShell id={id("city")} label={FIELD_LABELS.city} error={errors.city}>
              {text("city", { autoComplete: "address-level2", list: `${uid}-cities`, placeholder: "e.g. Karachi" })}
              <datalist id={`${uid}-cities`}>
                {CITY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </FieldShell>
            <FieldShell id={id("province")} label={FIELD_LABELS.province} error={errors.province} optional>
              <div className="relative">
                <select
                  id={id("province")}
                  name="province"
                  value={values.province}
                  onChange={(e) => set("province", e.target.value)}
                  autoComplete="address-level1"
                  className={cn(inputCls(false), "appearance-none pr-10")}
                >
                  <option value="">Select province</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <Icon name="chevronDown" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
              </div>
            </FieldShell>
            <FieldShell id={id("postalCode")} label={FIELD_LABELS.postalCode} error={errors.postalCode} optional>
              {text("postalCode", { autoComplete: "postal-code", inputMode: "numeric", placeholder: "75300" })}
            </FieldShell>
            <FieldShell id={id("notes")} label={FIELD_LABELS.notes} error={errors.notes} optional className="sm:col-span-2">
              <textarea
                id={id("notes")}
                name="notes"
                rows={2}
                maxLength={500}
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Landmark or delivery instructions"
                className={cn(inputCls(Boolean(errors.notes)), "h-auto py-3")}
              />
            </FieldShell>
          </div>
        </fieldset>

        <fieldset aria-describedby={errors.paymentMethod ? `${id("paymentMethod")}-error` : undefined}>
          <legend className="font-display text-2xl">Payment</legend>
          <div className="mt-5 grid gap-3 sm:grid-cols-2" id={id("paymentMethod")} tabIndex={-1}>
            {methods.map((m) => (
              <label
                key={m}
                className={cn(
                  "relative flex cursor-pointer gap-3 rounded-card border bg-surface p-4 transition-colors",
                  method === m ? "border-ink ring-1 ring-ink" : "border-stone-strong hover:border-ink",
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m}
                  checked={method === m}
                  onChange={() => {
                    setMethod(m);
                    setErrors((e) => ({ ...e, paymentMethod: "" }));
                  }}
                  className="mt-0.5 size-4.5 accent-ink"
                />
                <span>
                  <span className="block text-sm font-semibold">{PAYMENT_METHOD_LABELS[m]}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
                    {isManual(m) ? MANUAL_HELP[m] : METHOD_HELP[m]}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {errors.paymentMethod ? (
            <p id={`${id("paymentMethod")}-error`} className="mt-2 flex items-center gap-1 text-sm text-sale">
              <Icon name="alert" className="size-3.5" /> {errors.paymentMethod}
            </p>
          ) : null}
          {isManual(method) ? (
            <p className="mt-4 rounded-card bg-accent-soft p-4 text-sm text-accent-strong" data-testid="manual-payment-note">
              After you place the order we&rsquo;ll show our {PAYMENT_METHOD_LABELS[method]} account details. Send exactly{" "}
              <strong>{formatPrice(quote.totals.total)}</strong>, then upload your Transaction ID and a screenshot of the receipt. Your
              payment shows as <strong>Pending Verification</strong> until our team checks it. Never share your PIN or OTP with anyone.
            </p>
          ) : null}
          {isOnline(method) ? (
            <p className="mt-4 rounded-card bg-accent-soft p-4 text-sm text-accent-strong">
              After you place the order you&rsquo;ll be taken to {PAYMENT_METHOD_LABELS[method]}&rsquo;s secure page to pay{" "}
              <strong>{formatPrice(quote.totals.total)}</strong>. We never ask for your PIN or OTP on this website. Your order is
              confirmed as soon as {PAYMENT_METHOD_LABELS[method]} confirms the payment to us.
            </p>
          ) : null}
        </fieldset>

        <div className="hidden lg:block">
          <Button type="submit" size="lg" className="w-full" disabled={submitting || quote.hasIssues}>
            {submitting ? "Placing your order…" : isOnline(method) ? `Place order & pay · ${formatPrice(quote.totals.total)}` : `Place order · ${formatPrice(quote.totals.total)}`}
          </Button>
        </div>
      </div>

      <aside aria-labelledby="checkout-summary" className="lg:sticky lg:top-24 lg:self-start" ref={summaryRef}>
        <div className="rounded-card border border-stone bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 id="checkout-summary" className="font-display text-2xl">
              Your order
            </h2>
            <Link href="/cart" className="text-sm underline underline-offset-4">
              Edit bag
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-stone border-y border-stone">
            {quote.lines.map((l) => (
              <li key={l.variantId} className="flex gap-3 py-3 text-sm">
                <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-xs bg-sand">
                  {l.image ? <ProductImage src={l.image.url} alt="" fill sizes="56px" className="object-cover" /> : null}
                  <span className="absolute -top-0 -right-0 rounded-bl-xs bg-ink px-1.5 text-[0.6875rem] font-semibold text-surface">
                    {l.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.productName ?? "Unavailable item"}</p>
                  {l.color ? (
                    <p className="text-xs text-muted">
                      {l.color} · {l.size}
                    </p>
                  ) : null}
                </div>
                <p className="tabular-nums">{formatPrice(l.unitPrice * l.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <TotalsTable totals={quote.totals} couponCode={quote.coupon?.valid ? quote.coupon.code : null} />
          </div>
          {quote.coupon && !quote.coupon.valid ? (
            <p className="mt-3 text-xs text-sale">Coupon {quote.coupon.code}: {quote.coupon.message}</p>
          ) : null}
        </div>
        <div className="mt-5 lg:hidden">
          <Button type="submit" size="lg" className="w-full" disabled={submitting || quote.hasIssues}>
            {submitting ? "Placing your order…" : isOnline(method) ? `Place order & pay · ${formatPrice(quote.totals.total)}` : `Place order · ${formatPrice(quote.totals.total)}`}
          </Button>
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
          <Icon name="shield" className="size-4" /> Prices and stock are confirmed when you place the order.
        </p>
      </aside>
    </form>
  );
}
