import { describe, expect, it } from "vitest";
import { withTx, type Db } from "./helpers";

type Report = {
  summary: Record<string, number | string>;
  series: Array<{ period: string; orders: number; sales: number | string; collected: number | string }>;
  best_sellers: Array<{ name: string; qty: number; revenue: number | string }>;
  by_method: Array<{ method: string; orders: number; sales: number | string }>;
};

/** Place an order now, then move it to a Karachi-local timestamp. */
async function orderAt(db: Db, variantId: string, qty: number, method: "cod" | "easypaisa", karachiTime: string) {
  const o = await db.placeOrder({ items: [{ variant_id: variantId, quantity: qty }], method });
  await db.asOwner();
  await db.query("update orders set created_at = ($1::timestamp at time zone 'Asia/Karachi') where id = $2", [karachiTime, o.order_id]);
  return o;
}

async function report(db: Db, admin: string, from: string, to: string, group = "day") {
  await db.as("authenticated", admin);
  return (await db.one<{ r: Report }>("select public.admin_report($1, $2, $3) as r", [from, to, group])).r;
}

describe("admin_report", () => {
  it("is admin-only and validates the range", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const admin = await db.createUser({ admin: true });
      await db.as("authenticated", alice);
      expect((await db.fails("select public.admin_report('2025-01-01', '2025-01-31', 'day')")).message).toBe("forbidden");
      await db.as("authenticated", admin);
      expect((await db.fails("select public.admin_report('2025-02-01', '2025-01-01', 'day')")).message).toBe("invalid_range");
      expect((await db.fails("select public.admin_report('2025-01-01', '2025-01-31', 'week')")).message).toBe("invalid_group");
    });
  });

  it("daily totals in Pakistan time; cancelled orders are not sales; best sellers by units", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      // Two variants of DIFFERENT products (best sellers are per product).
      const [a, b] = await db.rows<{ id: string; price: string }>(
        `select distinct on (p.id) v.id, coalesce(v.price_override, p.base_price)::text as price
           from product_variants v join products p on p.id = v.product_id
          where v.is_active and p.is_active and v.stock_quantity >= 5
          order by p.id, v.sku limit 2`,
      );
      // 10 Jan 2025: two orders, one at 23:50 Karachi (would be 18:50 UTC — still the 10th).
      const o1 = await orderAt(db, a.id, 2, "cod", "2025-01-10 10:00");
      const o2 = await orderAt(db, b.id, 1, "easypaisa", "2025-01-10 23:50");
      // 11 Jan 00:10 Karachi is 10 Jan 19:10 UTC — must count on the 11th.
      const o3 = await orderAt(db, a.id, 1, "cod", "2025-01-11 00:10");
      // Cancelled on the 11th: counted as an order, not as sales.
      const o4 = await orderAt(db, b.id, 3, "cod", "2025-01-11 12:00");
      await db.query("update orders set status = 'cancelled' where id = $1", [o4.order_id]);
      // Paid → collected.
      await db.query("update orders set payment_status = 'paid' where id = $1", [o1.order_id]);

      const r = await report(db, admin, "2025-01-10", "2025-01-12");
      const sales = Number(o1.total_amount) + Number(o2.total_amount) + Number(o3.total_amount);
      expect(Number(r.summary.orders)).toBe(4);
      expect(Number(r.summary.valid_orders)).toBe(3);
      expect(Number(r.summary.sales)).toBeCloseTo(sales);
      expect(Number(r.summary.collected)).toBeCloseTo(Number(o1.total_amount));
      expect(Number(r.summary.cancelled)).toBe(1);
      expect(Number(r.summary.items_sold)).toBe(4);
      expect(Number(r.summary.avg_order_value)).toBeCloseTo(Math.round((sales / 3) * 100) / 100);

      expect(r.series.map((p) => [p.period.slice(0, 10), p.orders])).toEqual([
        ["2025-01-10", 2],
        ["2025-01-11", 2],
        ["2025-01-12", 0],
      ]);
      expect(Number(r.series[1].sales)).toBeCloseTo(Number(o3.total_amount));

      expect(r.best_sellers[0]).toMatchObject({ qty: 3 }); // variant a: 2 + 1 (the cancelled 3 of b don't count)
      expect(r.best_sellers[1]).toMatchObject({ qty: 1 });
      expect(Number(r.best_sellers[0].revenue)).toBeCloseTo(Number(a.price) * 3);

      const methods = Object.fromEntries(r.by_method.map((m) => [m.method, m.orders]));
      expect(methods).toEqual({ cod: 2, easypaisa: 1 });

      const monthly = await report(db, admin, "2024-12-01", "2025-01-31", "month");
      expect(monthly.series.map((p) => [p.period.slice(0, 7), p.orders])).toEqual([
        ["2024-12", 0],
        ["2025-01", 4],
      ]);
    });
  });
});
