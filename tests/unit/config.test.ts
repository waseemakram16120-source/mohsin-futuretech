import { describe, expect, it } from "vitest";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, isWalletMethod, storeConfig } from "@/config/store";

describe("store config", () => {
  it("offers COD, EasyPaisa, JazzCash and NayaPay", () => {
    expect(PAYMENT_METHODS).toEqual(["cod", "easypaisa", "jazzcash", "nayapay"]);
    expect(Object.keys(PAYMENT_METHOD_LABELS)).toEqual([...PAYMENT_METHODS]);
    expect(isWalletMethod("cod")).toBe(false);
    expect(isWalletMethod("easypaisa")).toBe(true);
    expect(isWalletMethod("card")).toBe(false);
  });

  it("limits uploads to JPG/PNG/WebP up to 5 MB", () => {
    expect(storeConfig.uploads.maxImageBytes).toBe(5 * 1024 * 1024);
    expect(storeConfig.uploads.allowedImageTypes).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("uses a WhatsApp number in international format", () => {
    expect(storeConfig.contact.whatsapp).toMatch(/^92\d{10}$/);
  });
});
