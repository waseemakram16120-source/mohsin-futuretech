"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PAYMENT_METHOD_LABELS, type GatewayMethod } from "@/config/store";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { evidenceFieldsSchema, receiptProblem } from "@/lib/payments/evidence";

export interface ManualPanelState {
  paymentStatus: string;
  orderStatus: string;
  transactionId: string | null;
  submittedAt: string | null;
  reviewNote: string | null;
}

type Errors = Partial<Record<"transactionId" | "note" | "receipt", string>>;

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(new Date(iso));
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-xs border border-stone-strong px-2.5 py-1 text-xs font-medium hover:border-ink"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the number is visible to copy by hand.
        }
      }}
      aria-label={`Copy ${label}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * Manual EasyPaisa / JazzCash payment (proposal §4). The customer pays the
 * store's account in their wallet app, then submits the Transaction ID and a
 * receipt. The payment stays "Pending Verification" until an admin reviews
 * it; nothing here can mark it approved or paid.
 */
export function ManualPaymentPanel({
  orderNumber,
  method,
  amount,
  account,
  initial,
}: {
  orderNumber: string;
  method: GatewayMethod;
  amount: number;
  account: { accountName: string; accountNumber: string } | null;
  initial: ManualPanelState;
}) {
  const router = useRouter();
  const uid = useId();
  const label = PAYMENT_METHOD_LABELS[method];
  const [state, setState] = useState(initial);
  const [transactionId, setTransactionId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const previewRef = useRef<string | null>(null);
  const choosePreview = (f: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = f ? URL.createObjectURL(f) : null;
    setPreview(previewRef.current);
  };
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const closed = state.orderStatus === "cancelled" || state.orderStatus === "returned";
  const approved = state.paymentStatus === "approved" || state.paymentStatus === "paid";
  const pending = state.paymentStatus === "pending_verification";
  const rejected = state.paymentStatus === "rejected";
  const canSubmit = !closed && !approved && !pending && account !== null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setServerError(null);
    const next: Errors = {};
    const fields = evidenceFieldsSchema.safeParse({ transactionId, note });
    if (!fields.success) {
      for (const issue of fields.error.issues) next[issue.path[0] as keyof Errors] ??= issue.message;
    }
    const fileProblem = receiptProblem(file);
    if (fileProblem) next.receipt = fileProblem;
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = (["transactionId", "receipt", "note"] as const).find((f) => next[f]);
      if (first) document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }

    setBusy(true);
    const body = new FormData();
    body.set("orderNumber", orderNumber);
    body.set("transactionId", transactionId.trim());
    if (note.trim()) body.set("note", note.trim());
    body.set("receipt", file!);
    try {
      const res = await fetch("/api/payments/evidence", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setState((s) => ({ ...s, paymentStatus: "pending_verification", transactionId: transactionId.trim(), submittedAt: new Date().toISOString(), reviewNote: null }));
        setFile(null);
        choosePreview(null);
        router.refresh();
      } else {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        setServerError(data.error ?? "We couldn't save your payment details. Please try again.");
      }
    } catch {
      setServerError("Network error — please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  let tone: "success" | "warning" | "danger" | "neutral" = "neutral";
  let message: string;
  if (closed) {
    message = "This order is closed, so no payment is needed. Contact us if you have already paid.";
  } else if (approved) {
    tone = "success";
    message = `Payment approved. Thank you — we received ${formatPrice(amount)} via ${label}.`;
  } else if (pending) {
    tone = "warning";
    message = `Pending Verification — we received your payment details${state.transactionId ? ` (Transaction ID ${state.transactionId})` : ""}${
      state.submittedAt ? ` on ${formatDate(state.submittedAt)}` : ""
    }. Our team will check them and confirm your order. Please don't pay again.`;
  } else if (rejected) {
    tone = "danger";
    message = `We could not verify your payment${state.reviewNote ? `: ${state.reviewNote}` : "."} Please check the details and submit them again below.`;
  } else {
    message = `Send ${formatPrice(amount)} to our ${label} account, then submit your Transaction ID and receipt below.`;
  }

  const inputCls = (invalid: boolean) =>
    cn(
      "w-full rounded-xs border bg-surface px-3.5 text-base placeholder:text-muted sm:text-sm",
      invalid ? "border-sale" : "border-stone-strong focus:border-ink",
    );

  return (
    <div className="mt-4 space-y-5 text-sm" data-testid="manual-payment-panel">
      <p
        role="status"
        aria-live="polite"
        data-testid="payment-message"
        className={cn(
          "flex items-start gap-2 rounded-card p-4",
          tone === "success" && "bg-success-soft text-success",
          tone === "warning" && "bg-warning-soft text-warning",
          tone === "danger" && "bg-sale-soft text-sale",
          tone === "neutral" && "bg-accent-soft text-accent-strong",
        )}
      >
        <Icon name={approved ? "shield" : rejected ? "alert" : "wallet"} className="mt-0.5 size-4 shrink-0" />
        <span>{message}</span>
      </p>

      {canSubmit && account ? (
        <>
          <div className="rounded-card border border-stone p-4 sm:p-5" data-testid="wallet-instructions">
            <h3 className="font-semibold">How to pay with {label}</h3>
            <dl className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr]">
              <dt className="text-ink-soft">Account name</dt>
              <dd className="font-medium" data-testid="wallet-account-name">
                {account.accountName}
              </dd>
              <dt className="text-ink-soft">Account number</dt>
              <dd className="flex items-center gap-3">
                <span className="font-mono text-base font-semibold tracking-wide" data-testid="wallet-account-number">
                  {account.accountNumber}
                </span>
                <CopyButton value={account.accountNumber.replace(/\s/g, "")} label={`${label} account number`} />
              </dd>
              <dt className="text-ink-soft">Amount to send</dt>
              <dd className="font-semibold tabular-nums" data-testid="wallet-amount">
                {formatPrice(amount)}
              </dd>
              <dt className="text-ink-soft">Reference</dt>
              <dd className="font-mono">{orderNumber}</dd>
            </dl>
            <ol className="mt-4 list-decimal space-y-1.5 pl-5 leading-relaxed text-ink-soft">
              <li>Open your {label} app and choose Send Money.</li>
              <li>
                Send exactly <strong className="text-ink">{formatPrice(amount)}</strong> to the account above. Add your order number as
                the reference if the app allows it.
              </li>
              <li>Copy the Transaction ID (TID) from the confirmation and take a screenshot.</li>
              <li>Submit both below. We never ask for your PIN or OTP.</li>
            </ol>
          </div>

          <form onSubmit={submit} noValidate className="space-y-4" aria-labelledby={`${uid}-form-title`}>
            <h3 id={`${uid}-form-title`} className="font-semibold">
              {rejected ? "Submit your payment details again" : "Submit your payment details"}
            </h3>
            <div>
              <label htmlFor={`${uid}-transactionId`} className="font-medium">
                Transaction ID
              </label>
              <input
                id={`${uid}-transactionId`}
                name="transactionId"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. 012345678901"
                aria-invalid={Boolean(errors.transactionId)}
                aria-describedby={errors.transactionId ? `${uid}-transactionId-error` : undefined}
                className={cn(inputCls(Boolean(errors.transactionId)), "mt-1.5 h-12 font-mono")}
              />
              {errors.transactionId ? (
                <p id={`${uid}-transactionId-error`} className="mt-1 flex items-center gap-1 text-sale">
                  <Icon name="alert" className="size-3.5 shrink-0" /> {errors.transactionId}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor={`${uid}-receipt`} className="font-medium">
                Payment receipt (screenshot)
              </label>
              <input
                id={`${uid}-receipt`}
                name="receipt"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  choosePreview(f);
                  setErrors((x) => ({ ...x, receipt: f ? receiptProblem(f) ?? undefined : x.receipt }));
                }}
                aria-invalid={Boolean(errors.receipt)}
                aria-describedby={errors.receipt ? `${uid}-receipt-error` : `${uid}-receipt-hint`}
                className="mt-1.5 block w-full text-sm file:mr-3 file:h-10 file:rounded-xs file:border file:border-ink file:bg-surface file:px-4 file:text-sm file:font-medium"
              />
              {errors.receipt ? (
                <p id={`${uid}-receipt-error`} className="mt-1 flex items-center gap-1 text-sale">
                  <Icon name="alert" className="size-3.5 shrink-0" /> {errors.receipt}
                </p>
              ) : (
                <p id={`${uid}-receipt-hint`} className="mt-1 text-xs text-muted">
                  JPG, PNG or WebP, up to 5 MB.
                </p>
              )}
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimisable URL
                <img src={preview} alt="Receipt preview" className="mt-3 max-h-64 rounded-xs border border-stone object-contain" />
              ) : null}
            </div>

            <div>
              <label htmlFor={`${uid}-note`} className="font-medium">
                Note <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                id={`${uid}-note`}
                name="note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                aria-invalid={Boolean(errors.note)}
                className={cn(inputCls(Boolean(errors.note)), "mt-1.5 py-3")}
              />
              {errors.note ? <p className="mt-1 text-sale">{errors.note}</p> : null}
            </div>

            {serverError ? (
              <p role="alert" className="rounded-card bg-sale-soft p-3 text-sale" data-testid="evidence-error">
                {serverError}
              </p>
            ) : null}
            <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto">
              {busy ? "Submitting…" : "Submit payment details"}
            </Button>
          </form>
        </>
      ) : !closed && !approved && !pending && account === null ? (
        <p className="rounded-card border border-stone p-4 text-ink-soft">
          Our {label} account details are being updated. Please contact us on WhatsApp with your order number and we&rsquo;ll share
          how to pay.
        </p>
      ) : null}
    </div>
  );
}
