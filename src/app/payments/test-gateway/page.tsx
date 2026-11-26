import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { payments } from "@/lib/payments/registry";
import { signTestOutcome } from "@/lib/payments/providers/test-gateway";
import type { ProviderResult } from "@/lib/payments/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac } from "node:crypto";

export const metadata: Metadata = { title: "Sandbox test gateway", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const OUTCOMES: Array<{ result: ProviderResult; label: string; tone: string }> = [
  { result: "paid", label: "Simulate successful payment", tone: "bg-success text-surface" },
  { result: "failed", label: "Simulate failed payment", tone: "bg-sale text-surface" },
  { result: "cancelled", label: "Simulate customer cancel", tone: "border border-ink" },
  { result: "pending", label: "Simulate pending (no decision yet)", tone: "border border-ink" },
];

/**
 * INTERNAL SANDBOX TEST GATEWAY — stands in for a provider's hosted page so
 * the whole flow can be tested. Never available in production (config).
 */
export default async function TestGatewayPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { config } = payments();
  if (!config.testGateway.enabled) notFound();
  const { ref } = await searchParams;
  if (!ref || !/^[A-Za-z0-9]{12,40}$/.test(ref)) notFound();

  const { data } = await createAdminClient()
    .from("payment_attempts")
    .select("reference, amount_minor, currency, status, provider, order:orders(order_number, payment_method)")
    .eq("reference", ref)
    .eq("provider", "test")
    .maybeSingle();
  const attempt = data as { reference: string; amount_minor: number; currency: string; status: string; order: { order_number: string; payment_method: string } } | null;
  if (!attempt) notFound();

  const key = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "missing").update("mft-test-gateway-v1").digest("hex");

  return (
    <div className="container-page max-w-xl py-12">
      <p role="note" className="rounded-card border-2 border-warning bg-warning-soft p-4 text-sm font-semibold text-warning">
        SANDBOX TEST GATEWAY — this is not JazzCash or Easypaisa and no real money moves. It exists only to test the store&rsquo;s
        payment handling before the merchant sandbox is connected.
      </p>
      <h1 className="mt-8 font-display text-3xl">Test payment</h1>
      <dl className="mt-6 grid grid-cols-2 gap-3 rounded-card border border-stone bg-surface p-5 text-sm">
        <dt className="text-muted">Order</dt>
        <dd className="font-mono">{attempt.order.order_number}</dd>
        <dt className="text-muted">Method chosen</dt>
        <dd>{attempt.order.payment_method}</dd>
        <dt className="text-muted">Amount</dt>
        <dd className="font-semibold">
          {formatPrice(Number(attempt.amount_minor) / 100)} ({attempt.currency})
        </dd>
        <dt className="text-muted">Reference</dt>
        <dd className="font-mono text-xs break-all">{attempt.reference}</dd>
      </dl>
      <div className="mt-6 grid gap-3">
        {OUTCOMES.map((o) => {
          const fields = signTestOutcome(key, {
            reference: attempt.reference,
            result: o.result,
            amountMinor: Number(attempt.amount_minor),
            currency: attempt.currency,
          });
          return (
            <form key={o.result} method="post" action="/api/payments/callback/test">
              {Object.entries(fields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <button type="submit" className={`h-12 w-full rounded-xs px-4 text-sm font-semibold ${o.tone}`}>
                {o.label}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
