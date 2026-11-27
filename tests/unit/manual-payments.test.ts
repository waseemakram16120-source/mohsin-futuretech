import { describe, expect, it } from "vitest";
import { parsePaymentsConfig } from "@/lib/payments/config";
import { EVIDENCE_ERRORS, evidenceFieldsSchema, receiptProblem, sniffImage } from "@/lib/payments/evidence";
import { checkoutMethods, isWalletAccountConfigured, walletModeFor } from "@/lib/payments/methods";

const real = { accountName: "Mohsin Traders", accountNumber: "0345 1234567" };

describe("wallet accounts", () => {
  it("accepts real-looking accounts only", () => {
    expect(isWalletAccountConfigured(real)).toBe(true);
    expect(isWalletAccountConfigured({ accountName: "PLACEHOLDER — set in Admin Settings", accountNumber: "03451234567" })).toBe(false);
    expect(isWalletAccountConfigured({ accountName: "Mohsin", accountNumber: "03XX-XXXXXXX" })).toBe(false);
    expect(isWalletAccountConfigured({ accountName: "Mohsin", accountNumber: "1234" })).toBe(false);
    expect(isWalletAccountConfigured({ accountName: "", accountNumber: "03451234567" })).toBe(false);
    expect(isWalletAccountConfigured({ accountName: null, accountNumber: null })).toBe(false);
    expect(isWalletAccountConfigured(undefined)).toBe(false);
  });
});

describe("payment modes and checkout methods", () => {
  it("wallets are manual unless listed as gateway methods", () => {
    expect(walletModeFor("jazzcash", [])).toBe("manual");
    expect(walletModeFor("jazzcash", ["jazzcash"])).toBe("gateway");
    expect(walletModeFor("easypaisa", ["jazzcash"])).toBe("manual");
  });

  it("manual wallets need configured accounts; gateway wallets need an available provider", () => {
    const none = () => false;
    expect(checkoutMethods({ gatewayMethods: [], gatewayAvailable: none, wallets: {} })).toEqual(["cod"]);
    expect(checkoutMethods({ gatewayMethods: [], gatewayAvailable: none, wallets: { easypaisa: real } })).toEqual(["cod", "easypaisa"]);
    expect(checkoutMethods({ gatewayMethods: [], gatewayAvailable: none, wallets: { easypaisa: real, jazzcash: real } })).toEqual([
      "cod",
      "jazzcash",
      "easypaisa",
    ]);
    // Gateway mode ignores the manual account and depends on the provider.
    expect(checkoutMethods({ gatewayMethods: ["jazzcash"], gatewayAvailable: none, wallets: { jazzcash: real } })).toEqual(["cod"]);
    expect(checkoutMethods({ gatewayMethods: ["jazzcash"], gatewayAvailable: () => true, wallets: {} })).toEqual(["cod", "jazzcash"]);
    // "We accept" lists ignore account details.
    expect(checkoutMethods({ gatewayMethods: [], gatewayAvailable: none, wallets: null })).toEqual(["cod", "jazzcash", "easypaisa"]);
  });

  it("PAYMENTS_GATEWAY_METHODS is parsed strictly; default is all manual", () => {
    expect(parsePaymentsConfig({}).gatewayMethods).toEqual([]);
    expect(parsePaymentsConfig({ PAYMENTS_GATEWAY_METHODS: " JazzCash , easypaisa,jazzcash" }).gatewayMethods).toEqual(["jazzcash", "easypaisa"]);
    const c = parsePaymentsConfig({ PAYMENTS_GATEWAY_METHODS: "nayapay" });
    expect(c.gatewayMethods).toEqual([]);
    expect(c.errors.join(" ")).toContain('unknown method "nayapay"');
  });
});

describe("evidence validation", () => {
  it("Transaction ID: 6–40 letters, digits or dashes", () => {
    expect(evidenceFieldsSchema.safeParse({ transactionId: " 012345678901 " }).data?.transactionId).toBe("012345678901");
    expect(evidenceFieldsSchema.safeParse({ transactionId: "TID-AB12CD" }).success).toBe(true);
    for (const bad of ["", "12345", "has space 123", "drop;table", "x".repeat(41)]) {
      expect(evidenceFieldsSchema.safeParse({ transactionId: bad }).success).toBe(false);
    }
    expect(evidenceFieldsSchema.safeParse({ transactionId: "123456", note: "n".repeat(501) }).success).toBe(false);
  });

  it("detects JPG, PNG and WebP from the bytes, not the name", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.ext).toBe("png");
    expect(sniffImage(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))?.ext).toBe("webp");
    expect(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(sniffImage(new Uint8Array([]))).toBeNull();
  });

  it("browser-side receipt checks", () => {
    expect(receiptProblem(null)).toMatch(/Attach/);
    expect(receiptProblem({ size: 0, type: "image/png" })).toMatch(/Attach/);
    expect(receiptProblem({ size: 6 * 1024 * 1024, type: "image/png" })).toMatch(/5 MB/);
    expect(receiptProblem({ size: 1000, type: "application/pdf" })).toMatch(/JPG, PNG or WebP/);
    expect(receiptProblem({ size: 1000, type: "image/webp" })).toBeNull();
  });

  it("every database error code has a safe customer message", () => {
    for (const code of ["evidence_already_submitted", "payment_already_approved", "transaction_id_used", "cod_no_evidence", "order_closed", "payment_in_progress", "invalid_transaction_id", "invalid_receipt"]) {
      expect(EVIDENCE_ERRORS[code].message.length).toBeGreaterThan(10);
    }
  });
});
