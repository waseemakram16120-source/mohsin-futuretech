import "server-only";

import { createHmac } from "node:crypto";
import { GATEWAY_METHODS, type GatewayMethod } from "@/config/store";
import { parsePaymentsConfig, type PaymentsConfig } from "./config";
import { blockedProvider } from "./providers/blocked";
import { testGatewayProvider } from "./providers/test-gateway";
import type { PaymentProvider, ProviderId } from "./providers/types";

let cached: { config: PaymentsConfig; providers: Record<ProviderId, PaymentProvider> } | null = null;

function testKey(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHmac("sha256", secret || "missing").update("mft-test-gateway-v1").digest("hex");
}

export function payments() {
  if (cached) return cached;
  const config = parsePaymentsConfig(process.env);
  const providers: Record<ProviderId, PaymentProvider> = {
    jazzcash: blockedProvider("jazzcash", "JazzCash", config.jazzcash),
    easypaisa: blockedProvider("easypaisa", "Easypaisa", config.easypaisa),
    test: testGatewayProvider({ ...config.testGateway, key: testKey(), baseUrl: config.baseUrl }),
  };
  cached = { config, providers };
  return cached;
}

/**
 * Which provider handles an order paid with `method`: the real merchant
 * adapter when it is enabled; otherwise, OUTSIDE production only, the
 * clearly-labelled sandbox test gateway; otherwise none (method hidden).
 */
export function providerFor(method: GatewayMethod): PaymentProvider | null {
  const { config, providers } = payments();
  const real = providers[method];
  if (real.availability().enabled && (config.env === "sandbox" || config.liveEnabled)) return real;
  if (providers.test.availability().enabled) return providers.test;
  return null;
}

export function providerById(id: string): PaymentProvider | null {
  const { providers } = payments();
  return id === "jazzcash" || id === "easypaisa" || id === "test" ? providers[id] : null;
}

/** Payment methods customers may choose right now. */
export function enabledPaymentMethods(): Array<"cod" | GatewayMethod> {
  return ["cod", ...GATEWAY_METHODS.filter((m) => providerFor(m) !== null)];
}

/** For admins / docs: why each provider is (un)available. */
export function paymentsStatus() {
  const { config, providers } = payments();
  return {
    env: config.env,
    liveEnabled: config.liveEnabled,
    errors: config.errors,
    providers: Object.fromEntries(
      Object.values(providers).map((p) => [p.id, p.availability()]),
    ) as Record<ProviderId, { enabled: boolean; reason: string }>,
  };
}
