import { describe, expect, it } from "vitest";
import { withTx, type Db } from "./helpers";

const payload = (over: Record<string, unknown> = {}) => ({
  name: "Test Parka",
  slug: `test-parka-${Math.random().toString(36).slice(2, 8)}`,
  category_id: "",
  audience: "men",
  description: "",
  details: ["Warm"],
  base_price: 9000,
  compare_at_price: "",
  is_active: true,
  is_featured: false,
  is_new_arrival: true,
  variants: [
    { id: "", size: "M", color: "Black", color_hex: "#111111", sku: `TP-M-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, price_override: "", stock: 4, is_active: true },
  ],
  ...over,
});

async function save(db: Db, id: string | null, p: object) {
  return (await db.one<{ id: string }>("select public.admin_save_product($1, $2) as id", [id, JSON.stringify(p)])).id;
}

describe("admin_save_product", () => {
  it("is admin-only", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      await db.as("authenticated", alice);
      expect((await db.fails("select public.admin_save_product(null, $1)", [JSON.stringify(payload())])).message).toBe("forbidden");
    });
  });

  it("creates a product with variants and logs opening stock; edits keep variant ids", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      await db.as("authenticated", admin);
      const p = payload();
      const id = await save(db, null, p);
      await db.asOwner();
      const [v] = await db.rows<{ id: string; stock_quantity: number }>("select id, stock_quantity from product_variants where product_id = $1", [id]);
      expect(v.stock_quantity).toBe(4);
      expect(await db.rows("select 1 from inventory_movements where variant_id = $1 and reason = 'initial' and change = 4", [v.id])).toHaveLength(1);

      // Edit: rename + add a size. Existing variant id unchanged; stock not touched by the form.
      await db.as("authenticated", admin);
      await save(db, id, {
        ...p,
        name: "Test Parka II",
        variants: [
          { ...p.variants[0], id: v.id, stock: 999 },
          { id: "", size: "L", color: "Black", color_hex: "#111111", sku: `${p.variants[0].sku}-L`, price_override: 9500, stock: 2, is_active: true },
        ],
      });
      await db.asOwner();
      const rows = await db.rows<{ id: string; size: string; stock_quantity: number }>(
        "select id, size, stock_quantity from product_variants where product_id = $1 order by sort_order",
        [id],
      );
      expect(rows.map((r) => [r.size, r.stock_quantity])).toEqual([["M", 4], ["L", 2]]);
      expect(rows[0].id).toBe(v.id);
    });
  });

  it("all-or-nothing: a duplicate SKU or slug saves nothing", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      await db.asOwner();
      const [taken] = await db.rows<{ sku: string; slug: string }>("select v.sku, p.slug from product_variants v join products p on p.id = v.product_id limit 1");
      await db.as("authenticated", admin);
      const before = (await db.one<{ n: string }>("select count(*) as n from products")).n;
      const dupSku = payload({ variants: [{ ...payload().variants[0], sku: taken.sku }] });
      expect((await db.fails("select public.admin_save_product(null, $1)", [JSON.stringify(dupSku)])).message).toBe("duplicate_sku");
      expect((await db.fails("select public.admin_save_product(null, $1)", [JSON.stringify(payload({ slug: taken.slug }))])).message).toBe("duplicate_slug");
      expect((await db.one<{ n: string }>("select count(*) as n from products")).n).toBe(before);
    });
  });
});

describe("product delete guard and customers list", () => {
  it("ordered products cannot be deleted, only archived", async () => {
    await withTx(async (db) => {
      const v = await db.variantWithStock(2);
      await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "cod" });
      await db.asOwner();
      expect((await db.fails("delete from products where id = $1", [v.product_id])).message).toBe("product_has_orders");
    });
  });

  it("admin_customers counts orders and spend; admin-only", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser({ name: "Alice Customer" });
      const admin = await db.createUser({ admin: true });
      const v = await db.variantWithStock(2);
      const order = await db.placeOrder({ userId: alice, items: [{ variant_id: v.id, quantity: 1 }], method: "cod" });
      await db.as("authenticated", alice);
      expect((await db.fails("select * from public.admin_customers(null, 25, 0)")).message).toBe("forbidden");
      await db.as("authenticated", admin);
      const [row] = await db.rows<{ orders_count: string; total_spent: string; total_count: string }>(
        "select * from public.admin_customers('Alice Customer', 25, 0)",
      );
      expect(Number(row.orders_count)).toBe(1);
      expect(Number(row.total_spent)).toBe(Number(order.total_amount));
      expect(Number(row.total_count)).toBeGreaterThanOrEqual(1);
    });
  });
});
