import type { ProviderCredentials } from "../config";
import { sha256Hex } from "../crypto";
import { ProviderUnavailableError, type PaymentProvider, type ProviderId } from "./types";

/**
 * JazzCash and Easypaisa adapters — FAIL CLOSED.
 *
 * The official merchant integration guides (endpoints, request fields,
 * secure-hash algorithm and field ordering, response codes, status-inquiry
 * API) could not be obtained: both providers publish them only to approved
 * merchants (portal login), and their public sites rejected automated
 * access. Per the payment specification, nothing is guessed:
 *   - availability() is always disabled with the reason below;
 *   - initiate() refuses;
 *   - verifyCallback() rejects every message (it is still logged as a
 *     rejected event, so probing is visible).
 * Implement `initiate` and `verifyCallback` from the official guide, add
 * the sandbox tests listed in docs/PAYMENTS.md, then remove this guard.
 */
export function blockedProvider(id: Exclude<ProviderId, "test">, label: string, creds: ProviderCredentials): PaymentProvider {
  const reason =
    `Blocked: the official ${label} merchant integration guide has not been provided, so the adapter is not implemented` +
    (creds.missing.length ? `; missing credentials: ${creds.missing.join(", ")}` : "") +
    ". See docs/PAYMENTS.md.";
  return {
    id,
    label,
    availability: () => ({ enabled: false, reason }),
    async initiate() {
      throw new ProviderUnavailableError(id, reason);
    },
    async verifyCallback({ params }) {
      const raw = JSON.stringify(Object.keys(params).sort().map((k) => [k, params[k]]));
      return {
        verified: false,
        reference: null,
        reason: "provider_not_implemented",
        dedupeKey: `${id}:rejected:${sha256Hex(raw).slice(0, 48)}:${Date.now()}`,
      };
    },
  };
}
