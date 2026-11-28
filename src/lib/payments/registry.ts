import "server-only";

import { createHmac } from "node:crypto";
import type { GatewayMethod, PaymentMethod } from "@/config/store";
import type { StoreSettings } from "@/lib/catalog/mappers";
import { parsePaymentsConfig, type PaymentsConfig } from "./config";
import { checkoutMethods, walletModeFor, type WalletMode } from "./methods";
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

/** How a wallet is paid right now: merchant gateway or manual evidence. */
export function walletMode(method: GatewayMethod): WalletMode {
  return walletModeFor(method, payments().config.gatewayMethods);
}

/**
 * Which provider handles a GATEWAY-mode order paid with `method`: the real
 * merchant adapter when it is enabled; otherwise, OUTSIDE production only,
 * the clearly-labelled sandbox test gateway; otherwise none. Manual-mode
 * wallets never have a provider.
 */
export function providerFor(method: GatewayMethod): PaymentProvider | null {
  const { config, providers } = payments();
  if (walletModeFor(method, config.gatewayMethods) !== "gateway") return null;
  const real = providers[method];
  if (real.availability().enabled && (config.env === "sandbox" || config.liveEnabled)) return real;
  if (providers.test.availability().enabled) return providers.test;
  return null;
}

export function providerById(id: string): PaymentProvider | null {
  const { providers } = payments();
  return id === "jazzcash" || id === "easypaisa" || id === "test" ? providers[id] : null;
}

/**
 * Methods the store accepts, ignoring wallet account details. Used for
 * "we accept" lists (footer, bag), which may be cached.
 */
export function enabledPaymentMethods(): PaymentMethod[] {
  return checkoutMethods({
    gatewayMethods: payments().config.gatewayMethods,
    gatewayAvailable: (m) => providerFor(m) !== null,
    wallets: null,
  });
}

/**
 * Methods a customer may choose at checkout right now. Manual wallets also
 * need the store's account details (read LIVE, not from a cache).
 */
export function checkoutPaymentMethods(settings: StoreSettings): PaymentMethod[] {
  return checkoutMethods({
    gatewayMethods: payments().config.gatewayMethods,
    gatewayAvailable: (m) => providerFor(m) !== null,
    wallets: settings.wallets,
  });
}

/** For admins / docs: why each provider is (un)available. */
export function paymentsStatus() {
  const { config, providers } = payments();
  return {
    env: config.env,
    liveEnabled: config.liveEnabled,
    gatewayMethods: config.gatewayMethods,
    errors: config.errors,
    providers: Object.fromEntries(
      Object.values(providers).map((p) => [p.id, p.availability()]),
    ) as Record<ProviderId, { enabled: boolean; reason: string }>,
  };
}
