/**
 * Payment instructions (Step 4 — manual verification only).
 *
 * Shows the store's wallet account (EasyPaisa / JazzCash / NayaPay), the
 * exact amount due, and the step-by-step instructions from the proposal
 * (§4). When the store owner has not configured an account yet, a clear
 * placeholder is shown — never a fake number.
 */
"use client";

import { useState } from "react";
import { formatPKR } from "@/lib/constants";
import {
  getPaymentAccount,
  getPaymentSteps,
  type WalletMethod,
} from "@/lib/payments";

export default function PaymentInstructions({
  method,
  amount,
  orderNumber,
  compact = false,
}: {
  method: WalletMethod;
  amount: number;
  orderNumber: string;
  compact?: boolean;
}) {
  const account = getPaymentAccount(method);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard unavailable — the value is still visible to copy by hand.
    }
  }

  const steps = getPaymentSteps(method, formatPKR(amount));

  return (
    <section className="rounded-xl border border-zinc-200 p-5">
      <h2 className="text-lg font-bold text-zinc-900">
        Pay via {account.label}
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        This is a manual payment — no automatic gateway. Pay in your{" "}
        {account.label} app, then submit your Transaction ID and receipt
        screenshot below.
      </p>

      <dl className="mt-4 space-y-2 rounded-lg bg-zinc-50 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-600">Order</dt>
          <dd className="font-bold text-zinc-900">{orderNumber}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-zinc-200 pt-2">
          <dt className="text-zinc-600">Amount to send</dt>
          <dd className="font-extrabold text-[#0f2440]">{formatPKR(amount)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-2">
          <dt className="text-zinc-600">{account.label} account name</dt>
          <dd className="font-semibold text-zinc-900">
            {account.configured
              ? account.accountName
              : "Account details to be added by the store owner"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-2">
          <dt className="text-zinc-600">{account.label} account number</dt>
          {account.configured ? (
            <dd className="flex items-center gap-2">
              <span className="font-bold text-zinc-900">{account.accountNumber}</span>
              <button
                type="button"
                onClick={() => copy(account.accountNumber!, "number")}
                className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-bold text-[#0f2440] hover:border-[#0f2440]"
              >
                {copied === "number" ? "Copied ✓" : "Copy"}
              </button>
            </dd>
          ) : (
            <dd className="font-semibold text-amber-700">Not set yet</dd>
          )}
        </div>
      </dl>

      {!account.configured && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          The store has not published its {account.label} account details yet.
          Please contact the store for the account number before sending
          payment — do not send money to any other account.
        </p>
      )}

      {!compact && (
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
