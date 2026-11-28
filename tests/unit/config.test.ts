import { describe, expect, it } from "vitest";
import { ALL_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, isGatewayMethod, storeConfig } from "@/config/store";

describe("store config", () => {
  it("offers COD, JazzCash and Easypaisa (NayaPay kept only for old orders)", () => {
    expect(PAYMENT_METHODS).toEqual(["cod", "jazzcash", "easypaisa"]);
    expect(Object.keys(PAYMENT_METHOD_LABELS).sort()).toEqual([...ALL_PAYMENT_METHODS].sort());
    expect(isGatewayMethod("cod")).toBe(false);
    expect(isGatewayMethod("easypaisa")).toBe(true);
    expect(isGatewayMethod("nayapay")).toBe(false);
    expect(isGatewayMethod("card")).toBe(false);
  });

  it("limits uploads to JPG/PNG/WebP up to 5 MB", () => {
    expect(storeConfig.uploads.maxImageBytes).toBe(5 * 1024 * 1024);
    expect(storeConfig.uploads.allowedImageTypes).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("uses a WhatsApp number in international format", () => {
    expect(storeConfig.contact.whatsapp).toMatch(/^92\d{10}$/);
  });
});
