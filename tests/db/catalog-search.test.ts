import { describe, expect, it } from "vitest";
import { withTx, type Db } from "./helpers";

interface SearchArgs {
  category?: string | null;
  audience?: "men" | "women" | "unisex" | null;
  q?: string | null;
  sizes?: string[] | null;
  colors?: string[] | null;
  min?: number | null;
  max?: number | null;
  inStock?: boolean;
  onSale?: boolean;
  newOnly?: boolean;
  sort?: string;
  limit?: number;
  offset?: number;
}

async function search(db: Db, a: SearchArgs = {}) {
  await db.as("anon");
  const rows = await db.rows<{ slug: string; total: string; price: string }>(
    `select p.slug, s.total_count::text as total,
            (select min(coalesce(v.price_override, p.base_price)) from public.product_variants v
              where v.product_id = p.id and v.is_active)::text as price
       from public.catalog_search($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) with ordinality s
       join public.products p on p.id = s.product_id
      order by s.ordinality`,
    [
      a.category ?? null, a.audience ?? null, a.q ?? null, a.sizes ?? null, a.colors ?? null,
      a.min ?? null, a.max ?? null, a.inStock ?? false, a.onSale ?? false, a.newOnly ?? false,
      a.sort ?? "featured", a.limit ?? 24, a.offset ?? 0,
    ],
  );
  return { slugs: rows.map((r) => r.slug), total: rows.length ? Number(rows[0].total) : 0, prices: rows.map((r) => Number(r.price)) };
}

describe("catalog_search", () => {
  it("lists every active product and never inactive ones", async () => {
    await withTx(async (db) => {
      const r = await search(db);
      expect(r.total).toBe(17);
      expect(r.slugs).not.toContain("archived-bomber-jacket");
    });
  });

  it("filters by category and by audience (men/women include unisex)", async () => {
    await withTx(async (db) => {
      const jeans = await search(db, { category: "jeans" });
      expect(jeans.total).toBe(4);
      const men = await search(db, { audience: "men" });
      expect(men.slugs).toContain("leather-belt"); // unisex
      expect(men.slugs).not.toContain("womens-satin-blouse");
      const women = await search(db, { audience: "women" });
      expect(women.slugs).toContain("canvas-baseball-cap");
      expect(women.slugs).not.toContain("leather-bifold-wallet"); // men only
    });
  });

  it("matches partial words, plurals and category names", async () => {
    await withTx(async (db) => {
      expect((await search(db, { q: "puff jack" })).slugs).toEqual(["mens-quilted-puffer-jacket"]);
      const jackets = await search(db, { q: "jackets", sort: "relevance" });
      expect(jackets.total).toBe(4);
      expect(jackets.slugs).toContain("womens-belted-trench-coat"); // via its category
      expect((await search(db, { q: "DENIM" })).slugs).toContain("womens-cropped-denim-jacket");
      expect((await search(db, { q: "zzzzqx" })).total).toBe(0);
      expect((await search(db, { q: "%%%" })).total).toBe(0);
      expect((await search(db, { q: "   " })).total).toBe(17); // blank = no query
    });
  });

  it("size, colour and in-stock must hold on the SAME variant", async () => {
    await withTx(async (db) => {
      await db.asOwner();
      // Make Puffer M/Black sold out while M/Olive stays in stock.
      await db.query(
        `update public.product_variants v set stock_quantity = case when color = 'Black' then 0 else 5 end
           from public.products p where p.id = v.product_id and p.slug = 'mens-quilted-puffer-jacket' and v.size = 'M'`,
      );
      const blackM = await search(db, { sizes: ["M"], colors: ["Black"], inStock: true, category: "jackets" });
      expect(blackM.slugs).not.toContain("mens-quilted-puffer-jacket");
      const oliveM = await search(db, { sizes: ["M"], colors: ["Olive"], inStock: true, category: "jackets" });
      expect(oliveM.slugs).toContain("mens-quilted-puffer-jacket");
      const anyM = await search(db, { sizes: ["M"], colors: ["Black"], category: "jackets" });
      expect(anyM.slugs).toContain("mens-quilted-puffer-jacket"); // stock not required
    });
  });

  it("filters by price range and sale / new flags", async () => {
    await withTx(async (db) => {
      const mid = await search(db, { min: 3000, max: 4000 });
      expect(mid.prices.every((p) => p >= 3000 && p <= 4000)).toBe(true);
      expect(mid.total).toBeGreaterThan(0);
      const sale = await search(db, { onSale: true });
      expect(sale.total).toBe(6);
      const fresh = await search(db, { newOnly: true });
      expect(fresh.total).toBe(6);
    });
  });

  it("sorts by price both ways and keeps featured first by default", async () => {
    await withTx(async (db) => {
      const asc = await search(db, { sort: "price-asc" });
      expect(asc.prices).toEqual([...asc.prices].sort((a, b) => a - b));
      const desc = await search(db, { sort: "price-desc" });
      expect(desc.prices).toEqual([...desc.prices].sort((a, b) => b - a));
      await db.asOwner();
      const featuredCount = Number(
        (await db.one<{ n: string }>("select count(*)::text n from public.products where is_active and is_featured")).n,
      );
      await db.as("anon");
      const def = await search(db);
      const flags = await db.rows<{ is_featured: boolean }>(
        "select is_featured from unnest($1::text[]) with ordinality s(slug, o) join public.products p using (slug) order by o",
        [def.slugs],
      );
      expect(flags.slice(0, featuredCount).every((f) => f.is_featured)).toBe(true);
    });
  });

  it("paginates with a stable total", async () => {
    await withTx(async (db) => {
      const p1 = await search(db, { limit: 5, offset: 0, sort: "price-asc" });
      const p2 = await search(db, { limit: 5, offset: 5, sort: "price-asc" });
      expect(p1.slugs).toHaveLength(5);
      expect(p1.total).toBe(17);
      expect(p2.total).toBe(17);
      expect(p1.slugs.some((s) => p2.slugs.includes(s))).toBe(false);
    });
  });
});

describe("catalog_facets", () => {
  it("returns the sizes, colours and price range for a scope", async () => {
    await withTx(async (db) => {
      await db.as("anon");
      const { f } = await db.one<{ f: { sizes: string[]; colors: Array<{ name: string; hex: string }>; min_price: number; max_price: number; total: number } }>(
        "select public.catalog_facets('jeans') as f",
      );
      expect(f.total).toBe(4);
      expect(f.sizes.sort()).toEqual(["26", "28", "30", "32", "34", "36"]);
      expect(f.colors.map((c) => c.name)).toEqual(["Black", "Dark Blue", "Indigo", "Light Blue", "Mid Blue"]);
      expect(Number(f.min_price)).toBe(3999);
      expect(Number(f.max_price)).toBe(4499);
    });
  });
});
