import type { ProviderResult } from "../status";

export type ProviderId = "jazzcash" | "easypaisa" | "test";

export interface AttemptForInitiation {
  reference: string;
  amountMinor: number;
  currency: "PKR";
  orderNumber: string;
  expiresAt: string;
  customer: { phone: string; email: string | null };
}

/** What the browser must do next to reach the provider's hosted flow. */
export type InitiationAction =
  | { type: "form_post"; action: string; fields: Record<string, string> }
  | { type: "redirect"; url: string };

/** A callback/return/status message AFTER the adapter verified it. */
export interface VerifiedMessage {
  verified: true;
  reference: string;
  result: ProviderResult;
  providerTxnId: string | null;
  amountMinor: number | null;
  currency: string | null;
  /** Unique per provider message: durable replay/duplicate key. */
  dedupeKey: string;
  /** Redacted, non-secret summary to store with the event. */
  summary: Record<string, string>;
}

export interface RejectedMessage {
  verified: false;
  /** Best-effort reference for the audit log (may be absent/forged). */
  reference: string | null;
  reason: string;
  dedupeKey: string;
}

export type CallbackVerification = VerifiedMessage | RejectedMessage;

export interface ProviderAvailability {
  enabled: boolean;
  /** Human-readable reason shown to admins/developers (never to customers). */
  reason: string;
}

export interface PaymentProvider {
  id: ProviderId;
  label: string;
  availability(): ProviderAvailability;
  initiate(attempt: AttemptForInitiation): Promise<InitiationAction>;
  /** Verify an incoming callback/return exactly per the provider's protocol. */
  verifyCallback(input: { method: string; params: Record<string, string> }): Promise<CallbackVerification>;
}

export class ProviderUnavailableError extends Error {
  constructor(provider: ProviderId, reason: string) {
    super(`${provider} is unavailable: ${reason}`);
    this.name = "ProviderUnavailableError";
  }
}
