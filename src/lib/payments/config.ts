/**
 * Payment configuration from SERVER environment variables (never NEXT_PUBLIC).
 * Pure `parsePaymentsConfig(env)` so every safety rule is unit-tested.
 *
 * Safety rules (payment spec §12, §19):
 *   - PAYMENTS_ENV is "sandbox" unless explicitly "production".
 *   - Production additionally requires PAYMENTS_LIVE_ENABLED=true (owner
 *     approval switch) and an https PAYMENTS_PUBLIC_BASE_URL.
 *   - The internal test gateway can NEVER run in production.
 *   - A provider with missing credentials is disabled — never faked.
 */
import { z } from "@/lib/z";

const blank = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export interface ProviderCredentials {
  /** All values the merchant portal issues; names follow docs/PAYMENTS.md. */
  values: Record<string, string>;
  missing: string[];
}

export interface PaymentsConfig {
  env: "sandbox" | "production";
  liveEnabled: boolean;
  baseUrl: string;
  testGateway: { enabled: boolean; reason: string };
  jazzcash: ProviderCredentials;
  easypaisa: ProviderCredentials;
  /**
   * Wallets paid through a direct merchant gateway. Every other wallet uses
   * the MANUAL flow from the proposal (§4): the customer pays the store's
   * account, then submits a Transaction ID + receipt for admin review.
   * Default: none (all manual). Set PAYMENTS_GATEWAY_METHODS=jazzcash,easypaisa
   * once a merchant gateway is approved and its adapter is complete.
   */
  gatewayMethods: Array<"jazzcash" | "easypaisa">;
  errors: string[];
}

/**
 * Credential variable names reserved for each provider. They are NOT a claim
 * about the providers' APIs: the adapters map them to the official fields
 * once the merchant integration guides are supplied (see docs/PAYMENTS.md).
 */
export const PROVIDER_ENV_VARS = {
  jazzcash: ["JAZZCASH_MERCHANT_ID", "JAZZCASH_PASSWORD", "JAZZCASH_INTEGRITY_SALT", "JAZZCASH_API_BASE_URL"],
  easypaisa: ["EASYPAISA_STORE_ID", "EASYPAISA_HASH_KEY", "EASYPAISA_API_BASE_URL"],
} as const;

function credentials(env: Record<string, string | undefined>, names: readonly string[]): ProviderCredentials {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const v = blank(env[name]);
    if (v) values[name] = v;
    else missing.push(name);
  }
  return { values, missing };
}

export function parsePaymentsConfig(env: Record<string, string | undefined>): PaymentsConfig {
  const errors: string[] = [];
  const payEnv = z.enum(["sandbox", "production"]).catch("sandbox").parse(blank(env.PAYMENTS_ENV) ?? "sandbox");
  const liveEnabled = payEnv === "production" && env.PAYMENTS_LIVE_ENABLED === "true";
  const baseUrl = (blank(env.PAYMENTS_PUBLIC_BASE_URL) ?? blank(env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3000").replace(/\/+$/, "");

  let baseOk = true;
  try {
    const u = new URL(baseUrl);
    if (payEnv === "production" && u.protocol !== "https:") {
      errors.push("PAYMENTS_PUBLIC_BASE_URL must use https in production.");
      baseOk = false;
    }
  } catch {
    errors.push("PAYMENTS_PUBLIC_BASE_URL is not a valid URL.");
    baseOk = false;
  }
  if (payEnv === "production" && !liveEnabled) {
    errors.push("Live payments are switched off (PAYMENTS_LIVE_ENABLED is not 'true').");
  }

  const isProductionDeploy = payEnv === "production" || env.VERCEL_ENV === "production";
  const testRequested = env.PAYMENTS_TEST_GATEWAY === "1";
  const testGateway = !testRequested
    ? { enabled: false, reason: "PAYMENTS_TEST_GATEWAY is not set." }
    : isProductionDeploy
      ? { enabled: false, reason: "The test gateway is never available in production." }
      : { enabled: true, reason: "Sandbox test gateway enabled (no real money)." };
  if (testRequested && isProductionDeploy) errors.push("PAYMENTS_TEST_GATEWAY must not be set in production.");

  const gatewayMethods: Array<"jazzcash" | "easypaisa"> = [];
  for (const raw of (env.PAYMENTS_GATEWAY_METHODS ?? "").split(",")) {
    const m = raw.trim().toLowerCase();
    if (!m) continue;
    if (m === "jazzcash" || m === "easypaisa") {
      if (!gatewayMethods.includes(m)) gatewayMethods.push(m);
    } else {
      errors.push(`PAYMENTS_GATEWAY_METHODS: unknown method "${m}" ignored.`);
    }
  }

  return {
    env: payEnv,
    liveEnabled: liveEnabled && baseOk,
    baseUrl,
    testGateway,
    jazzcash: credentials(env, PROVIDER_ENV_VARS.jazzcash),
    easypaisa: credentials(env, PROVIDER_ENV_VARS.easypaisa),
    gatewayMethods,
    errors,
  };
}
