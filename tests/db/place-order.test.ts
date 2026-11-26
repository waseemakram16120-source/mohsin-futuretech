import { describe, expect, it } from "vitest";
import { withTx, type Db } from "./helpers";

async function variantBySku(db: Db, sku: string) {
  await db.asOwner();
  return db.one<{ id: string; stock_quantity: number; price: string }>(
    `select v.id, v.stock_quantity, coalesce(v.price_override, p.base_price)::text as price
       from public.product_variants v join public.products p on p.id = v.product_id where v.sku = $1`,
    [sku],
  );
}

/** A variant of the given product with at least `min` units. */
async function stocked(db: Db, slug: string, min: number) {
  await db.asOwner();
  return db.one<{ id: string; stock_quantity: number; price: string; sku: string }>(
    `select v.id, v.sku, v.stock_quantity, coalesce(v.price_override, p.base_price)::text as price
       from public.product_variants v join public.products p on p.id = v.product_id
      where p.slug = $1 and v.stock_quantity >= $2 order by v.sku limit 1`,
    [slug, min],
  );
}

describe("place_order", () => {
  it("creates the order, items, payment, history and decrements stock atomically", async () => {
    await withTx(async (db) => {
      const v = await stocked(db, "mens-oxford-button-down-shirt", 2); // Rs 2,999
      const result = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 2 }] });

      expect(result).toMatchObject({
        subtotal: 5998,
        discount_amount: 0,
        delivery_charge: 0, // 5,998 ≥ free-delivery minimum of 5,000
        total_amount: 5998,
        payment_method: "cod",
        payment_status: "due",
        status: "pending",
      });
      expect(result.order_number).toMatch(/^MF-\d{6}-\d{5,}$/);

      await db.asOwner();
      const after = await variantBySku(db, v.sku);
      expect(after.stock_quantity).toBe(v.stock_quantity - 2);

      const order = await db.one<{ delivery_phone: string; user_id: string | null }>(
        "select delivery_phone, user_id from public.orders where id = $1",
        [result.order_id],
      );
      expect(order).toEqual({ delivery_phone: "03001234567", user_id: null });

      const items = await db.rows<{ quantity: number; unit_price: string; line_total: string }>(
        "select quantity, unit_price, line_total from public.order_items where order_id = $1",
        [result.order_id],
      );
      expect(items).toEqual([{ quantity: 2, unit_price: "2999.00", line_total: "5998.00" }]);

      const movement = await db.one<{ change: number; reason: string }>(
        "select change, reason from public.inventory_movements where order_id = $1",
        [result.order_id],
      );
      expect(movement).toEqual({ change: -2, reason: "order" });

      const payment = await db.one<{ status: string; amount: string }>(
        "select status, amount from public.payments where order_id = $1",
        [result.order_id],
      );
      expect(payment).toEqual({ status: "due", amount: "5998.00" });

      const history = await db.one<{ from_status: string | null; to_status: string }>(
        "select from_status, to_status from public.order_status_history where order_id = $1",
        [result.order_id],
      );
      expect(history).toEqual({ from_status: null, to_status: "pending" });
    });
  });

  it("charges delivery below the free-delivery minimum", async () => {
    await withTx(async (db) => {
      const v = await stocked(db, "canvas-baseball-cap", 1); // Rs 1,299
      const result = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }] });
      expect(result).toMatchObject({ subtotal: 1299, delivery_charge: 250, total_amount: 1549 });
    });
  });

  it("wallet orders start as awaiting payment", async () => {
    await withTx(async (db) => {
      const v = await db.variantWithStock(3);
      for (const method of ["easypaisa", "jazzcash", "nayapay"] as const) {
        const result = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method });
        expect(result.payment_status).toBe("awaiting_payment");
      }
    });
  });

  it("merges duplicate lines for the same variant", async () => {
    await withTx(async (db) => {
      const v = await db.variantWithStock(4);
      const result = await db.placeOrder({
        items: [
          { variant_id: v.id, quantity: 1 },
          { variant_id: v.id, quantity: 2 },
        ],
      });
      await db.asOwner();
      const items = await db.rows<{ quantity: number }>(
        "select quantity from public.order_items where order_id = $1",
        [result.order_id],
      );
      expect(items).toEqual([{ quantity: 3 }]);
    });
  });

  it("rejects more than the available stock and changes nothing", async () => {
    await withTx(async (db) => {
      await db.asOwner();
      const v = await db.one<{ id: string; stock_quantity: number }>(
        `select v.id, v.stock_quantity from public.product_variants v
           join public.products p on p.id = v.product_id
          where p.is_active and v.stock_quantity between 2 and 9 order by v.sku limit 1`,
      );
      const before = await db.one<{ n: string }>("select count(*)::text as n from public.orders");
      await db.as("service_role");
      const err = await db.fails("select public.place_order(null, $1, $2, 'cod', null)", [
        { name: "Ali Khan", phone: "03001234567", address: "House 1, Street 2, Area", city: "Karachi" },
        JSON.stringify([{ variant_id: v.id, quantity: v.stock_quantity + 1 }]),
      ]);
      expect(err.message).toBe("out_of_stock");
      expect(JSON.parse(err.detail ?? "{}")).toEqual({ variant_id: v.id, available: v.stock_quantity });

      await db.asOwner();
      const after = await db.one<{ n: string }>("select count(*)::text as n from public.orders");
      expect(after.n).toBe(before.n);
      const unchanged = await db.one<{ stock_quantity: number }>(
        "select stock_quantity from public.product_variants where id = $1",
        [v.id],
      );
      expect(unchanged.stock_quantity).toBe(v.stock_quantity);
    });
  });

  it("rejects sold-out, inactive and unknown variants", async () => {
    await withTx(async (db) => {
      await db.asOwner();
      const soldOut = await db.one<{ id: string }>(
        `select v.id from public.product_variants v join public.products p on p.id = v.product_id
          where v.stock_quantity = 0 and p.is_active limit 1`,
      );
      const archived = await db.one<{ id: string }>(
        "select id from public.product_variants where sku like 'JKT-018-%'",
      );
      await db.as("service_role");
      const customer = { name: "Ali Khan", phone: "03001234567", address: "House 1, Street 2, Area", city: "Karachi" };
      const call = (items: unknown) =>
        db.fails("select public.place_order(null, $1, $2, 'cod', null)", [customer, JSON.stringify(items)]);

      expect((await call([{ variant_id: soldOut.id, quantity: 1 }])).message).toBe("out_of_stock");
      expect((await call([{ variant_id: archived.id, quantity: 1 }])).message).toBe("variant_unavailable");
      expect((await call([{ variant_id: "00000000-0000-4000-8000-000000000000", quantity: 1 }])).message).toBe(
        "variant_unavailable",
      );
    });
  });

  it("validates cart shape, quantities and customer details", async () => {
    await withTx(async (db) => {
      const v = await db.variantWithStock(1);
      await db.as("service_role");
      const good = { name: "Ali Khan", phone: "03001234567", address: "House 1, Street 2, Area", city: "Karachi" };
      const call = (customer: unknown, items: unknown) =>
        db.fails("select public.place_order(null, $1, $2, 'cod', null)", [customer, JSON.stringify(items)]);

      expect((await call(good, [])).message).toBe("cart_empty");
      expect((await call(good, [{ variant_id: "not-a-uuid", quantity: 1 }])).message).toBe("invalid_item");
      expect((await call(good, [{ variant_id: v.id, quantity: 1.5 }])).message).toBe("invalid_item");
      expect((await call(good, [{ variant_id: v.id, quantity: -1 }])).message).toBe("invalid_item");
      expect((await call(good, [{ variant_id: v.id, quantity: 0 }])).message).toBe("invalid_quantity");
      expect((await call(good, [{ variant_id: v.id, quantity: 11 }])).message).toBe("invalid_quantity");
      expect((await call({ ...good, phone: "12345" }, [{ variant_id: v.id, quantity: 1 }])).message).toBe(
        "invalid_phone",
      );
      expect((await call({ ...good, address: "short" }, [{ variant_id: v.id, quantity: 1 }])).message).toBe(
        "invalid_customer",
      );
    });
  });

  it("applies a coupon, records the redemption and counts the use", async () => {
    await withTx(async (db) => {
      const v = await stocked(db, "mens-slim-fit-stretch-jeans", 1); // Rs 4,499
      const { used_count: usedBefore } = await db.one<{ used_count: number }>(
        "select used_count from public.coupons where code = 'WELCOME10'",
      );
      const result = await db.placeOrder({
        items: [{ variant_id: v.id, quantity: 1 }],
        coupon: " welcome10 ",
      });
      expect(result).toMatchObject({
        subtotal: 4499,
        discount_amount: 450, // 10% rounded
        delivery_charge: 250, // 4,049 < 5,000
        total_amount: 4299,
      });
      await db.asOwner();
      const coupon = await db.one<{ used_count: number }>(
        "select used_count from public.coupons where code = 'WELCOME10'",
      );
      expect(coupon.used_count).toBe(usedBefore + 1);
      expect(
        await db.rows("select id from public.coupon_redemptions where order_id = $1", [result.order_id]),
      ).toHaveLength(1);
    });
  });

  it("enforces coupon rules: minimum, expiry, usage limit, unknown", async () => {
    await withTx(async (db) => {
      const cheap = await stocked(db, "canvas-baseball-cap", 1);
      const pricey = await stocked(db, "mens-slim-fit-stretch-jeans", 1);
      await db.asOwner();
      await db.query("update public.coupons set used_count = max_uses where code = 'FLAT500'");
      await db.as("service_role");
      const customer = { name: "Ali Khan", phone: "03001234567", address: "House 1, Street 2, Area", city: "Karachi" };
      const call = (variant: string, coupon: string) =>
        db.fails("select public.place_order(null, $1, $2, 'cod', $3)", [
          customer,
          JSON.stringify([{ variant_id: variant, quantity: 1 }]),
          coupon,
        ]);
      expect((await call(cheap.id, "WELCOME10")).message).toBe("coupon_min_order");
      expect((await call(pricey.id, "EXPIRED20")).message).toBe("coupon_expired");
      expect((await call(pricey.id, "FLAT500")).message).toBe("coupon_used_up");
      expect((await call(pricey.id, "NOPE")).message).toBe("coupon_invalid");
    });
  });

  it("generates sequential, unique order numbers", async () => {
    await withTx(async (db) => {
      const v = await db.variantWithStock(2);
      const a = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }] });
      const b = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }] });
      const seq = (n: string) => Number(n.split("-")[2]);
      expect(seq(b.order_number)).toBe(seq(a.order_number) + 1);
    });
  });
});
