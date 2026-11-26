import { describe, expect, it } from "vitest";
import { mergeSettings, toProductCard } from "@/lib/catalog/mappers";
import { storeConfig } from "@/config/store";
import { productRow } from "./fixtures";

describe("toProductCard", () => {
  it("orders images, lists in-stock sizes once, and de-duplicates colours", () => {
    const card = toProductCard(productRow());
    expect(card.image).toEqual({ url: "/placeholders/a.svg", alt: "Front" });
    expect(card.hoverImage).toEqual({ url: "/placeholders/b.svg", alt: "Back" });
    expect(card.sizesInStock).toEqual(["30"]); // size 32 is sold out
    expect(card.colors.map((c) => c.name)).toEqual(["Indigo", "Black"]);
    expect(card.inStock).toBe(true);
    expect(card.price).toBe(4499);
    expect(card.priceVaries).toBe(false);
    expect(card.categoryName).toBe("Jeans");
  });

  it("uses the lowest variant price and flags varying prices", () => {
    const row = productRow();
    row.product_variants[1] = { ...row.product_variants[1], price_override: "3999.00" };
    const card = toProductCard(row);
    expect(card.price).toBe(3999);
    expect(card.priceVaries).toBe(true);
  });

  it("marks a product with no stock as sold out", () => {
    const row = productRow();
    row.product_variants = row.product_variants.map((v) => ({ ...v, stock_quantity: 0 }));
    const card = toProductCard(row);
    expect(card.inStock).toBe(false);
    expect(card.sizesInStock).toEqual([]);
  });

  it("falls back to the product name for empty alt text", () => {
    const card = toProductCard(productRow({ product_images: [{ url: "/x.svg", alt: "", sort_order: 0 }] }));
    expect(card.image?.alt).toBe("Men's Slim Fit Stretch Jeans");
    expect(card.hoverImage).toBeNull();
  });

  it("rejects malformed rows instead of rendering garbage", () => {
    expect(() => toProductCard({ ...productRow(), audience: "kids" })).toThrow();
    expect(() => toProductCard({ id: "nope" })).toThrow();
  });
});

describe("mergeSettings", () => {
  it("uses database values when present", () => {
    const s = mergeSettings({
      store_name: "Test Store",
      whatsapp_number: "923331112222",
      delivery_charge: "300.00",
      free_delivery_min: "6000.00",
      nayapay_account_name: "Ali",
      nayapay_account_number: "03001234567",
    });
    expect(s.storeName).toBe("Test Store");
    expect(s.whatsapp).toBe("923331112222");
    expect(s.deliveryCharge).toBe(300);
    expect(s.freeDeliveryMin).toBe(6000);
    expect(s.wallets.nayapay).toEqual({ accountName: "Ali", accountNumber: "03001234567" });
    expect(s.wallets.easypaisa).toEqual({ accountName: null, accountNumber: null });
  });

  it("falls back to src/config/store.ts for blanks or a missing row", () => {
    const s = mergeSettings({ store_name: "  ", support_email: null });
    expect(s.storeName).toBe(storeConfig.name);
    expect(s.email).toBe(storeConfig.contact.email);
    expect(mergeSettings(null).freeDeliveryMin).toBe(storeConfig.delivery.freeDeliveryMin);
  });
});
