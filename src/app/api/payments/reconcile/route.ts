import { safeEqual } from "@/lib/payments/crypto";
import { logPayment } from "@/lib/payments/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/payments/reconcile — for a scheduled job (Authorization:
 * Bearer $PAYMENTS_RECONCILE_SECRET). Expires never-sent attempts and lists
 * attempts whose outcome is uncertain. Querying each provider's official
 * transaction-status API is added with the provider adapters (blocked on
 * their documentation); until then uncertain attempts are reported for
 * manual follow-up and are NEVER assumed failed.
 */
export async function POST(request: Request) {
  const secret = process.env.PAYMENTS_RECONCILE_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret.length < 32 || !safeEqual(given, secret)) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await createAdminClient().rpc("payment_attempts_to_reconcile", { p_limit: 100 });
  if (error) return Response.json({ error: "Reconciliation failed." }, { status: 500 });
  const uncertain = (data ?? []) as Array<{ reference: string; provider: string; status: string }>;
  for (const a of uncertain) {
    logPayment("warn", { event: "needs_status_inquiry", provider: a.provider, reference: a.reference, status: a.status });
  }
  return Response.json({ uncertain: uncertain.length, statusInquiry: "not_available_until_provider_docs" });
}
