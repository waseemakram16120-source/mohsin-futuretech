import { describe, expect, it } from "vitest";
import {
  activeChips,
  clearFilters,
  filtersToSearch,
  hasActiveFilters,
  pageList,
  parseFilters,
  sortSizes,
  toggle,
  updateFilters,
} from "@/lib/catalog/filters";
import { formatPrice } from "@/lib/format";

describe("parseFilters / filtersToSearch", () => {
  it("round-trips every filter through the URL", () => {
    const params = { size: "M,L", color: "Black,Olive", min: "3000", max: "8000", stock: "1", sale: "1", sort: "price-asc", page: "2", q: "jacket" };
    const f = parseFilters(params);
    expect(f).toEqual({ q: "jacket", sizes: ["M", "L"], colors: ["Black", "Olive"], min: 3000, max: 8000, inStock: true, onSale: true, sort: "price-asc", page: 2 });
    expect(filtersToSearch(f)).toBe("?q=jacket&size=M%2CL&color=Black%2COlive&min=3000&max=8000&stock=1&sale=1&sort=price-asc&page=2");
    expect(parseFilters(Object.fromEntries(new URLSearchParams(filtersToSearch(f).slice(1))))).toEqual(f);
  });

  it("omits defaults so clean URLs stay clean", () => {
    expect(filtersToSearch(parseFilters({}))).toBe("");
    expect(filtersToSearch(parseFilters({ sort: "relevance" }, "relevance"), "relevance")).toBe("");
  });

  it("drops invalid values instead of failing", () => {
    const f = parseFilters({ min: "-5", max: "abc", sort: "cheapest", page: "0", stock: "yes", size: ",,M,M," });
    expect(f).toMatchObject({ min: null, max: null, sort: "featured", page: 1, inStock: false, sizes: ["M"] });
  });

  it("swaps a reversed price range and takes the first of repeated params", () => {
    expect(parseFilters({ min: "9000", max: "1000" })).toMatchObject({ min: 1000, max: 9000 });
    expect(parseFilters({ size: ["S", "XL"] }).sizes).toEqual(["S"]);
  });

  it("caps runaway input", () => {
    const many = Array.from({ length: 50 }, (_, i) => `c${i}`).join(",");
    expect(parseFilters({ color: many }).colors).toHaveLength(20);
    expect(parseFilters({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
});

describe("filter helpers", () => {
  const base = parseFilters({ size: "M", color: "Black", min: "1000", stock: "1", page: "3" });

  it("any change resets to page 1", () => {
    expect(updateFilters(base, { inStock: false }).page).toBe(1);
  });

  it("toggles values", () => {
    expect(toggle(["M"], "L")).toEqual(["M", "L"]);
    expect(toggle(["M", "L"], "M")).toEqual(["L"]);
  });

  it("builds removable chips and clears everything but search and sort", () => {
    const chips = activeChips(base, formatPrice);
    expect(chips.map((c) => c.label)).toEqual(["Size M", "Black", "From Rs 1,000", "In stock"]);
    expect(chips[0].next.sizes).toEqual([]);
    const withQ = { ...base, q: "jeans", sort: "price-desc" as const };
    const cleared = clearFilters(withQ);
    expect(hasActiveFilters(cleared)).toBe(false);
    expect(cleared).toMatchObject({ q: "jeans", sort: "price-desc", page: 1 });
  });
});

describe("sortSizes", () => {
  it("orders letter sizes, then numbers, then others, One Size last", () => {
    expect(sortSizes(["One Size", "34", "XL", "S", "30", "M", "Free", "L"])).toEqual(["S", "M", "L", "XL", "30", "34", "Free", "One Size"]);
  });
});

describe("pageList", () => {
  it("shows every page when there are few", () => {
    expect(pageList(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("collapses long ranges around the current page", () => {
    expect(pageList(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageList(1, 12)).toEqual([1, 2, null, 12]);
  });
});
