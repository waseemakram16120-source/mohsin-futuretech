import { beforeEach, describe, expect, it } from "vitest";
import { MAX_QTY, addLine, addToCart, cartCount, cartStore } from "@/lib/stores/cart";
import { MAX_WISHLIST, toggleEntry, toggleWishlist, wishlistStore } from "@/lib/stores/wishlist";

const v1 = "00000000-0000-4000-8000-000000000001";
const v2 = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  window.localStorage.clear();
});

describe("cart lines", () => {
  it("merges quantities and caps at the line maximum and stock", () => {
    let lines = addLine([], v1, 2);
    lines = addLine(lines, v1, 3);
    expect(lines).toEqual([{ variantId: v1, quantity: 5 }]);
    expect(addLine(lines, v1, 50)[0].quantity).toBe(MAX_QTY);
    expect(addLine([], v2, 5, 3)[0].quantity).toBe(3);
    expect(addLine([], v2, 1, 0)).toEqual([]); // sold out
    expect(cartCount([{ variantId: v1, quantity: 2 }, { variantId: v2, quantity: 3 }])).toBe(5);
  });

  it("persists to localStorage and notifies subscribers", () => {
    let calls = 0;
    const unsubscribe = cartStore.subscribe(() => calls++);
    addToCart(v1, 2);
    expect(cartStore.get()).toEqual([{ variantId: v1, quantity: 2 }]);
    expect(JSON.parse(window.localStorage.getItem("mft.cart.v1") ?? "[]")).toEqual([{ variantId: v1, quantity: 2 }]);
    expect(calls).toBe(1);
    unsubscribe();
  });

  it("ignores corrupted or tampered storage", () => {
    window.localStorage.setItem("mft.cart.v1", "{not json");
    expect(cartStore.get()).toEqual([]);
    window.localStorage.setItem("mft.cart.v1", JSON.stringify([{ variantId: "x", quantity: 999 }]));
    expect(cartStore.get()).toEqual([]);
  });
});

describe("wishlist", () => {
  it("toggles one entry per product, newest first", () => {
    let entries = toggleEntry([], v1, null, "t1");
    entries = toggleEntry(entries, v2, null, "t2");
    expect(entries.map((e) => e.productId)).toEqual([v2, v1]);
    expect(toggleEntry(entries, v1).map((e) => e.productId)).toEqual([v2]);
  });

  it("is capped", () => {
    const many = Array.from({ length: MAX_WISHLIST }, (_, i) => ({
      productId: `00000000-0000-4000-8000-${String(i + 10).padStart(12, "0")}`,
      variantId: null,
      addedAt: "t",
    }));
    expect(toggleEntry(many, v1)).toHaveLength(MAX_WISHLIST);
  });

  it("persists through the store", () => {
    toggleWishlist(v1);
    expect(wishlistStore.get().map((e) => e.productId)).toEqual([v1]);
    toggleWishlist(v1);
    expect(wishlistStore.get()).toEqual([]);
  });
});
