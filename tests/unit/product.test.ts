import { describe, expect, it } from "vitest";
import { sizeChartFor } from "@/config/size-guide";
import { findVariant, initialSelection, sizeStock, stockMessage, toProductDetail } from "@/lib/catalog/product";
import { detailRow } from "./fixtures";

describe("toProductDetail", () => {
  it("orders images, derives colours with availability and sorted sizes", () => {
    const p = toProductDetail(detailRow);
    expect(p.images).toEqual([
      { url: "/a.svg", alt: "Front" },
      { url: "/b.svg", alt: "Men's Quilted Puffer Jacket" },
    ]);
    expect(p.colors).toEqual([
      { name: "Black", hex: "#1F1F1F", inStock: true },
      { name: "Olive", hex: "#5B6236", inStock: true },
    ]);
    expect(p.sizes).toEqual(["S", "M", "XL"]);
    expect(p.variants.find((v) => v.sku === "JKT-001-M-OLIV")?.price).toBe(8499);
    expect(p.compareAtPrice).toBe(9999);
  });
});

describe("variant selection", () => {
  const p = toProductDetail(detailRow);

  it("finds the variant for a colour + size", () => {
    expect(findVariant(p, "Olive", "M")?.sku).toBe("JKT-001-M-OLIV");
    expect(findVariant(p, "Olive", "S")).toBeNull();
    expect(findVariant(p, null, "M")).toBeNull();
  });

  it("reports stock per size within the chosen colour", () => {
    expect(sizeStock(p, "Black", "M")).toBe(0);
    expect(sizeStock(p, "Olive", "M")).toBe(12);
    expect(sizeStock(p, null, "M")).toBe(12);
  });

  it("honours valid URL choices and ignores invalid ones", () => {
    expect(initialSelection(p, { color: "Olive", size: "M" })).toEqual({ color: "Olive", size: "M" });
    expect(initialSelection(p, { color: "Pink", size: "M" })).toEqual({ color: "Black", size: "M" });
    expect(initialSelection(p, { color: "Olive", size: "S" })).toEqual({ color: "Olive", size: null });
    expect(initialSelection(p, {})).toEqual({ color: "Black", size: null });
  });

  it("pre-selects the only size of one-size products", () => {
    const cap = toProductDetail({
      ...detailRow,
      product_variants: [{ ...detailRow.product_variants[0], size: "One Size" }],
    });
    expect(initialSelection(cap, {})).toEqual({ color: "Black", size: "One Size" });
  });

  it("writes an honest stock message", () => {
    const low = findVariant(p, "Black", "S");
    expect(stockMessage(null, 5)).toEqual({ tone: "neutral", text: "Select a size to see availability" });
    expect(stockMessage(low, 5)).toEqual({ tone: "warning", text: "Only 3 left — order soon" });
    expect(stockMessage(findVariant(p, "Olive", "M"), 5)).toEqual({ tone: "success", text: "In stock — ready to ship" });
    expect(stockMessage(findVariant(p, "Black", "M"), 5)).toEqual({ tone: "danger", text: "Sold out in this size" });
  });
});

describe("sizeChartFor", () => {
  it("maps categories to charts and skips one-size items", () => {
    expect(sizeChartFor("jackets", ["S", "M"])?.id).toBe("tops");
    expect(sizeChartFor("jeans", ["30", "32"])?.id).toBe("bottoms");
    expect(sizeChartFor("accessories", ["32", "34", "36"])?.id).toBe("belts");
    expect(sizeChartFor("accessories", ["One Size"])).toBeNull();
    expect(sizeChartFor(null, ["S", "M"])).toBeNull();
  });
});
