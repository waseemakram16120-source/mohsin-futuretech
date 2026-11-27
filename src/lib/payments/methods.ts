/**
 * Which payment methods a customer may choose, and how each wallet is paid.
 * Pure module (no server-only imports) so the rules are unit-tested.
 *
 *   - COD is always offered.
 *   - A wallet in "gateway" mode is offered only while its provider adapter
 *     is available (see registry.ts).
 *   - A wallet in "manual" mode (proposal §4: pay the store's account, then
 *     submit Transaction ID + receipt for admin review) is offered only when
 *     the store's account name and number are set in Admin → Settings, so a
 *     customer is never shown a placeholder number to pay into.
 */
import { GATEWAY_METHODS, type GatewayMethod, type PaymentMethod } from "@/config/store";

export type WalletMode = "gateway" | "manual";

export interface WalletAccount {
  accountName: string | null;
  accountNumber: string | null;
}

/** A real account: a name, at least 8 digits, and no "03XX…" style placeholder. */
export function isWalletAccountConfigured(account: WalletAccount | null | undefined): boolean {
  const name = account?.accountName?.trim() ?? "";
  const number = account?.accountNumber?.trim() ?? "";
  if (name.length < 2 || /placeholder/i.test(name)) return false;
  if (/x/i.test(number)) return false;
  return (number.match(/\d/g) ?? []).length >= 8;
}

export function walletModeFor(method: GatewayMethod, gatewayMethods: readonly GatewayMethod[]): WalletMode {
  return gatewayMethods.includes(method) ? "gateway" : "manual";
}

export function checkoutMethods({
  gatewayMethods,
  gatewayAvailable,
  wallets,
}: {
  gatewayMethods: readonly GatewayMethod[];
  gatewayAvailable: (method: GatewayMethod) => boolean;
  /** Pass null to ignore account details (e.g. the footer's "we accept" list). */
  wallets: Partial<Record<GatewayMethod, WalletAccount>> | null;
}): PaymentMethod[] {
  const offered: PaymentMethod[] = ["cod"];
  for (const method of GATEWAY_METHODS) {
    const ok =
      walletModeFor(method, gatewayMethods) === "gateway"
        ? gatewayAvailable(method)
        : wallets === null || isWalletAccountConfigured(wallets[method]);
    if (ok) offered.push(method);
  }
  return offered;
}
