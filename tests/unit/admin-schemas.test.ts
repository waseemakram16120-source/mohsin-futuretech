import { describe, expect, it } from "vitest";
import { couponInputSchema, firstIssues, productInputSchema, settingsInputSchema, slugify } from "@/lib/admin/schemas";

const variant = { size: "M", color: "Navy", colorHex: "#1F2937", sku: "jkt-m-navy", priceOverride: "", stock: "5", isActive: true };
const product = {
  name: "Slim Fit Jeans",
  slug: "slim-fit-jeans",
  categoryId: "",
  audience: "men",
  description: "",
  details: "98% cotton\n\n  Machine wash  ",
  basePrice: "3499",
  compareAtPrice: "",
  isActive: true,
  isFeatured: false,
  isNewArrival: true,
  variants: [variant],
};

describe("slugify", () => {
  it("makes clean web addresses", () => {
    expect(slugify("Men’s Slim-Fit Jeans (Blue)!")).toBe("mens-slim-fit-jeans-blue");
    expect(slugify("  Café   Crème  ")).toBe("cafe-creme");
    expect(slugify("---")).toBe("");
  });
});

describe("product form", () => {
  it("normalises input", () => {
    const r = productInputSchema.parse(product);
    expect(r).toMatchObject({ categoryId: null, basePrice: 3499, compareAtPrice: null, details: ["98% cotton", "Machine wash"] });
    expect(r.variants[0]).toMatchObject({ sku: "JKT-M-NAVY", stock: 5, priceOverride: null, id: null });
  });

  it("rejects bad prices, slugs, duplicates and SKUs", () => {
    const errs = (patch: object) => {
      const r = productInputSchema.safeParse({ ...product, ...patch });
      return r.success ? {} : firstIssues(r.error);
    };
    expect(errs({ basePrice: "0" }).basePrice).toBeDefined();
    expect(errs({ compareAtPrice: "3000" }).compareAtPrice).toMatch(/higher than the price/);
    expect(errs({ slug: "Slim Fit" }).slug).toMatch(/lowercase/);
    expect(errs({ variants: [] }).variants).toMatch(/at least one/);
    expect(errs({ variants: [variant, { ...variant, sku: "OTHER" }] })["variants.1.size"]).toMatch(/listed twice/);
    expect(errs({ variants: [variant, { ...variant, size: "L" }] })["variants.1.sku"]).toMatch(/used twice/);
    expect(errs({ variants: [{ ...variant, sku: "has space" }] })["variants.0.sku"]).toBeDefined();
    expect(errs({ variants: [{ ...variant, stock: "-1" }] })["variants.0.stock"]).toBeDefined();
    expect(errs({ variants: [{ ...variant, colorHex: "navy" }] })["variants.0.colorHex"]).toBeDefined();
  });
});

describe("coupon form", () => {
  const base = { code: "eid25", description: "", discountType: "percentage", discountValue: "25", minOrderAmount: "0", maxUses: "", validFrom: "", validUntil: "", isActive: true };
  it("accepts a valid coupon", () => {
    expect(couponInputSchema.parse(base)).toMatchObject({ code: "EID25", discountValue: 25, maxUses: null, validFrom: null });
  });
  it("limits percentages and checks dates", () => {
    expect(couponInputSchema.safeParse({ ...base, discountValue: "95" }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...base, discountType: "fixed", discountValue: "500" }).success).toBe(true);
    expect(couponInputSchema.safeParse({ ...base, validFrom: "2026-12-10", validUntil: "2026-12-01" }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...base, code: "E!" }).success).toBe(false);
  });
});

describe("settings form", () => {
  const base = {
    storeName: "Mohsin FutureTech", supportPhone: "", supportEmail: "", whatsapp: "", storeAddress: "",
    deliveryCharge: "250", freeDeliveryMin: "5000", lowStockThreshold: "5",
    easypaisaName: "", easypaisaNumber: "", jazzcashName: "", jazzcashNumber: "",
  };
  it("stores WhatsApp in wa.me format and empty values as null", () => {
    const r = settingsInputSchema.parse({ ...base, whatsapp: "0300 1234567" });
    expect(r).toMatchObject({ whatsapp: "923001234567", supportEmail: null, easypaisaNumber: null, deliveryCharge: 250 });
  });
  it("rejects bad numbers", () => {
    expect(settingsInputSchema.safeParse({ ...base, whatsapp: "12345" }).success).toBe(false);
    expect(settingsInputSchema.safeParse({ ...base, deliveryCharge: "-1" }).success).toBe(false);
    expect(settingsInputSchema.safeParse({ ...base, supportEmail: "nope" }).success).toBe(false);
  });
});
