import { describe, expect, it } from "vitest";
import { withTx } from "./helpers";

describe("catalogue access (RLS)", () => {
  it("shoppers see only active products, their images and variants", async () => {
    await withTx(async (db) => {
      await db.as("anon");
      const products = await db.rows<{ slug: string }>("select slug from public.products");
      expect(products.length).toBe(17);
      expect(products.map((p) => p.slug)).not.toContain("archived-bomber-jacket");

      const hiddenVariants = await db.rows(
        `select v.id from public.product_variants v where v.sku like 'JKT-018-%'`,
      );
      expect(hiddenVariants).toHaveLength(0);

      const categories = await db.rows("select slug from public.categories");
      expect(categories).toHaveLength(5);
      const images = await db.rows("select id from public.product_images");
      expect(images).toHaveLength(34);
    });
  });

  it("shoppers can read store settings but not coupons", async () => {
    await withTx(async (db) => {
      await db.as("anon");
      const settings = await db.one<{ delivery_charge: string }>(
        "select delivery_charge from public.store_settings",
      );
      expect(Number(settings.delivery_charge)).toBe(250);
      const err = await db.fails("select code from public.coupons");
      expect(err.code).toBe("42501");
    });
  });

  it("shoppers and customers cannot change the catalogue", async () => {
    await withTx(async (db) => {
      await db.as("anon");
      expect((await db.fails("update public.products set base_price = 1")).code).toBe("42501");
      expect(
        (await db.fails("insert into public.categories (name, slug) values ('Hack', 'hack')")).code,
      ).toBe("42501");

      const customer = await db.createUser();
      await db.as("authenticated", customer);
      // RLS hides the rows from the update, so nothing changes.
      const res = await db.query("update public.products set base_price = 1 returning id");
      expect(res.rowCount).toBe(0);
      expect(
        (await db.fails("insert into public.categories (name, slug) values ('Hack', 'hack')")).code,
      ).toBe("42501");
      const settings = await db.query("update public.store_settings set delivery_charge = 0 returning id");
      expect(settings.rowCount).toBe(0);
    });
  });

  it("admins manage the catalogue but cannot edit stock directly", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      await db.as("authenticated", admin);
      const res = await db.query(
        "update public.products set is_featured = true where slug = 'leather-belt' returning id",
      );
      expect(res.rowCount).toBe(1);
      const all = await db.rows("select id from public.products");
      expect(all).toHaveLength(18); // admins also see inactive products

      const err = await db.fails("update public.product_variants set stock_quantity = 999");
      expect(err.code).toBe("42501");
    });
  });

  it("coupon preview reveals only the code that was asked for", async () => {
    await withTx(async (db) => {
      await db.as("anon");
      const ok = await db.one<{ r: Record<string, unknown> }>(
        "select public.validate_coupon('welcome10', 3000) as r",
      );
      expect(ok.r).toMatchObject({ valid: true, code: "WELCOME10", discount: 300 });

      const low = await db.one<{ r: Record<string, unknown> }>(
        "select public.validate_coupon('WELCOME10', 1000) as r",
      );
      expect(low.r).toMatchObject({ valid: false, error: "coupon_min_order" });

      const expired = await db.one<{ r: Record<string, unknown> }>(
        "select public.validate_coupon('EXPIRED20', 9000) as r",
      );
      expect(expired.r).toMatchObject({ valid: false, error: "coupon_expired" });

      const unknown = await db.one<{ r: Record<string, unknown> }>(
        "select public.validate_coupon('NOPE', 9000) as r",
      );
      expect(unknown.r).toEqual({ valid: false, error: "coupon_invalid" });
    });
  });
});
