/**
 * Two customers buy the last unit at the same moment: exactly one order may
 * succeed. This test needs real concurrent connections, so it commits its
 * fixture and cleans up afterwards instead of using withTx().
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "./helpers";

const slug = `concurrency-test-${randomUUID().slice(0, 8)}`;
let variantId = "";

beforeAll(async () => {
  const { rows } = await pool.query<{ id: string }>(
    `with p as (
       insert into public.products (name, slug, base_price, audience)
       values ('Concurrency Test Tee', $1, 1000, 'unisex') returning id
     )
     insert into public.product_variants (product_id, sku, size, color, stock_quantity)
     select id, $2, 'M', 'Black', 1 from p returning id`,
    [slug, `TST-${randomUUID().slice(0, 8).toUpperCase()}`],
  );
  variantId = rows[0].id;
});

afterAll(async () => {
  await pool.query(
    `delete from public.orders where id in (
       select order_id from public.order_items where variant_id = $1)`,
    [variantId],
  );
  await pool.query("delete from public.products where slug = $1", [slug]);
});

async function buyLastUnit() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role service_role");
    const { rows } = await client.query(
      "select public.place_order(null, $1, $2, 'cod', null) as r",
      [
        { name: "Racer", phone: "03001234567", address: "House 1, Street 2, Area", city: "Karachi" },
        JSON.stringify([{ variant_id: variantId, quantity: 1 }]),
      ],
    );
    // Hold the lock briefly so the two transactions really overlap.
    await client.query("select pg_sleep(0.2)");
    await client.query("commit");
    return { ok: true as const, order: rows[0].r };
  } catch (error) {
    await client.query("rollback");
    return { ok: false as const, error: (error as Error).message };
  } finally {
    client.release();
  }
}

describe("concurrent checkout", () => {
  it("never oversells the last unit", async () => {
    const results = await Promise.all([buyLastUnit(), buyLastUnit(), buyLastUnit()]);
    const wins = results.filter((r) => r.ok);
    const losses = results.filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses.map((l) => (l.ok ? "" : l.error))).toEqual(["out_of_stock", "out_of_stock"]);

    const { rows } = await pool.query<{ stock_quantity: number }>(
      "select stock_quantity from public.product_variants where id = $1",
      [variantId],
    );
    expect(rows[0].stock_quantity).toBe(0);
  });
});
