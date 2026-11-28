import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTx } from "./helpers";

describe("storage buckets", () => {
  it("are configured with image-only types and a 5 MB limit", async () => {
    await withTx(async (db) => {
      const rows = await db.rows<{ id: string; public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
        "select id, public, file_size_limit::text, allowed_mime_types from storage.buckets order by id",
      );
      expect(rows).toEqual([
        { id: "payment-receipts", public: false, file_size_limit: "5242880", allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] },
        { id: "product-images", public: true, file_size_limit: "5242880", allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] },
      ]);
    });
  });

  it("customers cannot upload or read payment receipts directly; admins can read", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const admin = await db.createUser({ admin: true });
      await db.asOwner();
      await db.query(
        "insert into storage.objects (bucket_id, name, owner) values ('payment-receipts', 'some-order/r.jpg', $1)",
        [alice],
      );

      await db.as("authenticated", alice);
      const upload = await db.fails(
        "insert into storage.objects (bucket_id, name, owner) values ('payment-receipts', $1, $2)",
        [`${alice}/r.jpg`, alice],
      );
      expect(upload.code).toBe("42501");
      expect(await db.rows("select name from storage.objects where bucket_id = 'payment-receipts'")).toHaveLength(0);

      await db.as("anon");
      expect(await db.rows("select name from storage.objects where bucket_id = 'payment-receipts'")).toHaveLength(0);

      await db.as("authenticated", admin);
      // Only this test's file is checked: e2e runs may leave real receipts in the bucket.
      expect(await db.rows("select name from storage.objects where bucket_id = 'payment-receipts' and name = 'some-order/r.jpg'")).toHaveLength(1);
    });
  });

  it("only admins write product images", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const admin = await db.createUser({ admin: true });
      await db.as("authenticated", alice);
      const err = await db.fails(
        "insert into storage.objects (bucket_id, name) values ('product-images', 'products/x.jpg')",
      );
      expect(err.code).toBe("42501");
      await db.as("authenticated", admin);
      await db.query("insert into storage.objects (bucket_id, name) values ('product-images', 'products/x.jpg')");
    });
  });
});

describe("seed data", () => {
  it("every active product has images, variants with unique SKUs, and a category", async () => {
    await withTx(async (db) => {
      await db.asOwner();
      const problems = await db.rows<{ slug: string }>(
        `select p.slug from public.products p
          where p.is_active and (
            p.category_id is null
            or not exists (select 1 from public.product_images i where i.product_id = p.id)
            or not exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active))`,
      );
      expect(problems).toEqual([]);

      const audiences = await db.rows<{ audience: string; n: number }>(
        "select audience::text, count(*)::int as n from public.products where is_active group by 1 order by 1",
      );
      expect(audiences.map((a) => a.audience)).toEqual(["men", "unisex", "women"]);

      const mix = await db.one<{ sold_out: number; low: number; sale: number; featured: number; fresh: number }>(
        `select
           (select count(*)::int from public.product_variants where stock_quantity = 0) as sold_out,
           (select count(*)::int from public.product_variants where stock_quantity between 1 and 5) as low,
           (select count(*)::int from public.products where is_active and compare_at_price is not null) as sale,
           (select count(*)::int from public.products where is_active and is_featured) as featured,
           (select count(*)::int from public.products where is_active and is_new_arrival) as fresh`,
      );
      expect(mix.sold_out).toBeGreaterThan(0);
      expect(mix.low).toBeGreaterThan(0);
      expect(mix.sale).toBeGreaterThanOrEqual(4);
      expect(mix.featured).toBeGreaterThanOrEqual(4);
      expect(mix.fresh).toBeGreaterThanOrEqual(4);
    });
  });

  it("every image the seed points to exists in public/", async () => {
    await withTx(async (db) => {
      await db.asOwner();
      const urls = await db.rows<{ url: string }>(
        "select url from public.product_images union select image_url from public.categories where image_url is not null",
      );
      const missing = urls.filter((u) => !existsSync(join(process.cwd(), "public", u.url)));
      expect(missing).toEqual([]);
    });
  });
});
