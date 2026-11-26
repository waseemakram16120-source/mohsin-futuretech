import { describe, expect, it } from "vitest";
import { discountPercent, formatPrice, fullRows } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";

describe("formatPrice", () => {
  it("formats whole rupees with grouping", () => {
    expect(formatPrice(4499)).toBe("Rs 4,499");
    expect(formatPrice(1250000)).toBe("Rs 1,250,000");
    expect(formatPrice(0)).toBe("Rs 0");
    expect(formatPrice(99.6)).toBe("Rs 100");
  });
});

describe("discountPercent", () => {
  it("rounds down so badges never over-promise", () => {
    expect(discountPercent(7999, 9999)).toBe(20);
    expect(discountPercent(3499, 4299)).toBe(18);
  });
  it("is 0 without a real discount", () => {
    expect(discountPercent(1000, null)).toBe(0);
    expect(discountPercent(1000, 1000)).toBe(0);
    expect(discountPercent(1000, 900)).toBe(0);
  });
});

describe("fullRows", () => {
  it("keeps only complete rows when there is more than one row", () => {
    expect(fullRows([1, 2, 3, 4, 5, 6], 4)).toEqual([1, 2, 3, 4]);
    expect(fullRows([1, 2, 3, 4, 5, 6, 7, 8], 4)).toHaveLength(8);
    expect(fullRows([1, 2, 3], 4)).toEqual([1, 2, 3]);
  });
});

describe("whatsappLink", () => {
  it("builds a wa.me link with an encoded message", () => {
    expect(whatsappLink("923001234567", "Hi there!")).toBe("https://wa.me/923001234567?text=Hi%20there!");
    expect(whatsappLink("+92 300 1234567")).toBe("https://wa.me/923001234567");
  });
  it("returns null for missing or local-format numbers", () => {
    expect(whatsappLink(null)).toBeNull();
    expect(whatsappLink("03001234567")).toBeNull();
  });
});
