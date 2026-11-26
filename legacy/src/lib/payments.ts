/**
 * Payment instructions & validation (Step 4 — manual verification only).
 *
 * Wallet payments (EasyPaisa / JazzCash / NayaPay) are NEVER an automatic gateway: the customer pays
 * in their own wallet app, then submits a Transaction ID + receipt
 * screenshot here. An admin reviews it in Step 5. No automatic
 * gateway integration is included, per the proposal (§4, §6, §13).
 *
 * Account details come from public env vars when the store owner has set
 * them, otherwise a clear placeholder is shown — never a fake number.
 */
import type { PaymentMethod, PaymentStatus } from "./types";

export type WalletMethod = "easypaisa" | "jazzcash" | "nayapay";

export interface PaymentAccount {
  method: WalletMethod;
  label: string;
  accountName: string | null;
  accountNumber: string | null;
  /** True only when both name and number are configured. */
  configured: boolean;
}

/** Read the store's wallet accounts from env (set in .env.local). */
export function getPaymentAccount(method: WalletMethod): PaymentAccount {
  const label =
    method === "easypaisa"
      ? "EasyPaisa"
      : method === "jazzcash"
        ? "JazzCash"
        : "NayaPay";
  const name =
    method === "easypaisa"
      ? process.env.NEXT_PUBLIC_EASYPAISA_ACCOUNT_NAME
      : method === "jazzcash"
        ? process.env.NEXT_PUBLIC_JAZZCASH_ACCOUNT_NAME
        : process.env.NEXT_PUBLIC_NAYAPAY_ACCOUNT_NAME;
  const number =
    method === "easypaisa"
      ? process.env.NEXT_PUBLIC_EASYPAISA_ACCOUNT_NUMBER
      : method === "jazzcash"
        ? process.env.NEXT_PUBLIC_JAZZCASH_ACCOUNT_NUMBER
        : process.env.NEXT_PUBLIC_NAYAPAY_ACCOUNT_NUMBER;
  const accountName = name?.trim() ? name.trim() : null;
  const accountNumber = number?.trim() ? number.trim() : null;
  return {
    method,
    label,
    accountName,
    accountNumber,
    configured: accountName !== null && accountNumber !== null,
  };
}

/** Step-by-step instructions shown to the customer for a wallet payment. */
export function getPaymentSteps(
  method: WalletMethod,
  amountText: string,
): string[] {
  const label =
    method === "easypaisa"
      ? "EasyPaisa"
      : method === "jazzcash"
        ? "JazzCash"
        : "NayaPay";
  return [
    `Open your ${label} app on your phone.`,
    `Send ${amountText} to the ${label} account shown above.`,
    "Save the Transaction ID and take a screenshot of the payment receipt.",
    "Submit the Transaction ID and screenshot below — your payment will stay Pending Verification until the store approves it.",
  ];
}

/* ------------------------- Transaction ID validation ------------------------ */

/** Transaction IDs are 5–40 letters / digits (spaces and - _ allowed). */
export function validateTransactionId(value: string): string | null {
  const txn = value.trim();
  if (txn.length === 0) return "Please enter your Transaction ID.";
  if (txn.length < 5 || txn.length > 40) {
    return "Transaction ID must be between 5 and 40 characters.";
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(txn)) {
    return "Transaction ID can only contain letters, numbers, spaces, - and _.";
  }
  return null;
}

/* --------------------------- receipt file validation ------------------------ */

export const RECEIPT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
export const RECEIPT_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp";

/** Returns an error message, or null when the file is acceptable. */
export function validateReceiptFile(file: {
  type: string;
  size: number;
}): string | null {
  if (!RECEIPT_ACCEPTED_TYPES.includes(file.type as (typeof RECEIPT_ACCEPTED_TYPES)[number])) {
    return "Please upload a JPG, PNG or WebP image of your payment receipt.";
  }
  if (file.size > RECEIPT_MAX_SIZE) {
    return "Receipt screenshot must be 5 MB or smaller.";
  }
  if (file.size === 0) {
    return "That file looks empty. Please upload your receipt screenshot again.";
  }
  return null;
}

export function receiptExtension(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

/* ------------------------------ status helpers ------------------------------ */

/** True when the customer has already submitted payment evidence. */
export function hasPaymentEvidence(args: {
  paymentStatus: PaymentStatus;
  transactionId?: string | null;
}): boolean {
  return args.transactionId !== null && args.transactionId !== undefined && args.transactionId.trim() !== "";
}

/** Can the customer (re)submit evidence right now? */
export function canSubmitPayment(args: {
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId?: string | null;
}): { allowed: boolean; reason: string } {
  if (args.paymentMethod === "cod") {
    return {
      allowed: false,
      reason: "This is a Cash on Delivery order — you pay in cash when it arrives. No payment evidence is needed.",
    };
  }
  if (args.paymentStatus === "approved") {
    return {
      allowed: false,
      reason: "Your payment has already been approved. No further action is needed.",
    };
  }
  if (args.paymentStatus === "paid") {
    return {
      allowed: false,
      reason: "Your payment has already been marked as paid. No further action is needed.",
    };
  }
  if (
    args.paymentStatus === "pending_verification" &&
    hasPaymentEvidence({ paymentStatus: args.paymentStatus, transactionId: args.transactionId })
  ) {
    return {
      allowed: false,
      reason: "Your payment evidence is already submitted and Pending Verification. The store will review it — please wait for approval.",
    };
  }
  // Rejected, or pending with no evidence yet (fresh order) — allow submit.
  return { allowed: true, reason: "" };
}
