import { describe, expect, it } from "vitest";
import { buildPrimaryNav } from "@/components/layout/nav";

describe("buildPrimaryNav", () => {
  it("puts audiences first, then categories in order, then Sale", () => {
    const nav = buildPrimaryNav([
      { id: "1", name: "Jackets", slug: "jackets", description: null, imageUrl: null },
      { id: "2", name: "Jeans", slug: "jeans", description: null, imageUrl: null },
    ]);
    expect(nav.map((l) => l.href)).toEqual([
      "/new-arrivals",
      "/collections/men",
      "/collections/women",
      "/collections/jackets",
      "/collections/jeans",
      "/sale",
    ]);
    expect(nav.at(-1)?.emphasis).toBe("sale");
  });
});
