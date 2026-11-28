import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, ORDER_TRANSITIONS } from "@/lib/domain";
import { withTx, type Db } from "./helpers";

async function stock(db: Db, variantId: string) {
  await db.asOwner();
  const row = await db.one<{ stock_quantity: number }>(
    "select stock_quantity from public.product_variants where id = $1",
    [variantId],
  );
  return row.stock_quantity;
}

describe("order status workflow", () => {
  it("database transitions match ORDER_TRANSITIONS in src/lib/domain.ts", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const v = await db.variantWithStock(5);
      const order = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "cod" });

      for (const from of ORDER_STATUSES) {
        for (const to of ORDER_STATUSES) {
          await db.asOwner();
          await db.query("update public.orders set status = $1 where id = $2", [from, order.order_id]);
          await db.as("authenticated", admin);
          await db.query("savepoint t");
          let allowed = true;
          try {
            await db.query("select public.update_order_status($1, $2, null)", [order.order_id, to]);
          } catch (error) {
            allowed = false;
            expect((error as Error).message).toBe("invalid_transition");
          }
          await db.query("rollback to savepoint t");
          expect({ from, to, allowed }).toEqual({ from, to, allowed: ORDER_TRANSITIONS[from].includes(to) });
        }
      }
    });
  });

  it("walks a COD order through the full workflow with history", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const v = await db.variantWithStock(5);
      const order = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "cod" });
      await db.as("authenticated", admin);
      for (const to of ["confirmed", "processing", "shipped", "delivered"]) {
        await db.query("select public.update_order_status($1, $2, $3)", [order.order_id, to, `to ${to}`]);
      }
      await db.asOwner();
      const history = await db.rows<{ from_status: string | null; to_status: string }>(
        "select from_status, to_status from public.order_status_history where order_id = $1 order by created_at, to_status",
        [order.order_id],
      );
      expect(history.map((h) => h.to_status)).toEqual([
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
      ]);
    });
  });

  it("a wallet order cannot be confirmed before its payment is approved", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const v = await db.variantWithStock(5);
      const order = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "jazzcash" });
      await db.as("authenticated", admin);
      const err = await db.fails("select public.update_order_status($1, 'confirmed', null)", [order.order_id]);
      expect(err.message).toBe("payment_not_verified");
      // ...but it can be cancelled.
      await db.query("select public.update_order_status($1, 'cancelled', 'Customer did not pay')", [
        order.order_id,
      ]);
    });
  });

  it("cancelling puts stock back and logs it", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const v = await db.variantWithStock(5);
      const before = await stock(db, v.id);
      const order = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 3 }], method: "cod" });
      expect(await stock(db, v.id)).toBe(before - 3);

      await db.as("authenticated", admin);
      await db.query("select public.update_order_status($1, 'cancelled', null)", [order.order_id]);
      expect(await stock(db, v.id)).toBe(before);

      const moves = await db.rows<{ change: number; reason: string }>(
        "select change, reason from public.inventory_movements where order_id = $1 order by created_at, change",
        [order.order_id],
      );
      expect(moves).toEqual([
        { change: -3, reason: "order" },
        { change: 3, reason: "cancel" },
      ]);

      // Cancelled is final.
      await db.as("authenticated", admin);
      const err = await db.fails("select public.update_order_status($1, 'confirmed', null)", [order.order_id]);
      expect(err.message).toBe("invalid_transition");
    });
  });

  it("a returned order restocks", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const v = await db.variantWithStock(5);
      const before = await stock(db, v.id);
      const order = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 2 }], method: "cod" });
      await db.as("authenticated", admin);
      for (const to of ["confirmed", "processing", "shipped", "delivered", "returned"]) {
        await db.query("select public.update_order_status($1, $2, null)", [order.order_id, to]);
      }
      expect(await stock(db, v.id)).toBe(before);
    });
  });

  it("customers cannot change order status", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const v = await db.variantWithStock(5);
      const order = await db.placeOrder({ userId: alice, items: [{ variant_id: v.id, quantity: 1 }] });
      await db.as("authenticated", alice);
      const err = await db.fails("select public.update_order_status($1, 'cancelled', null)", [order.order_id]);
      expect(err.message).toBe("forbidden");
    });
  });
});

describe("stock adjustments", () => {
  it("admins adjust stock with an audit entry; stock never goes negative", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const v = await db.variantWithStock(2);
      await db.as("authenticated", admin);
      const up = await db.one<{ q: number }>("select public.adjust_stock($1, 10, 'New delivery') as q", [v.id]);
      expect(up.q).toBe(v.stock_quantity + 10);
      const err = await db.fails("select public.adjust_stock($1, $2, null)", [v.id, -(v.stock_quantity + 11)]);
      expect(err.message).toBe("stock_negative");
      expect((await db.fails("select public.adjust_stock($1, 0, null)", [v.id])).message).toBe("invalid_quantity");

      await db.asOwner();
      const move = await db.one<{ change: number; reason: string; actor_id: string; note: string }>(
        "select change, reason, actor_id, note from public.inventory_movements where variant_id = $1 and reason = 'adjustment'",
        [v.id],
      );
      expect(move).toEqual({ change: 10, reason: "adjustment", actor_id: admin, note: "New delivery" });
    });
  });

  it("customers cannot adjust stock", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const v = await db.variantWithStock(1);
      await db.as("authenticated", alice);
      expect((await db.fails("select public.adjust_stock($1, 5, null)", [v.id])).message).toBe("forbidden");
    });
  });

  it("new variants log their opening stock", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      await db.as("authenticated", admin);
      const p = await db.one<{ id: string }>("select id from public.products where slug = 'leather-belt'");
      const v = await db.one<{ id: string }>(
        `insert into public.product_variants (product_id, sku, size, color, stock_quantity)
         values ($1, 'ACC-TEST-40-BRWN', '40', 'Brown', 7) returning id`,
        [p.id],
      );
      await db.asOwner();
      const move = await db.one<{ change: number; reason: string; actor_id: string }>(
        "select change, reason, actor_id from public.inventory_movements where variant_id = $1",
        [v.id],
      );
      expect(move).toEqual({ change: 7, reason: "initial", actor_id: admin });
    });
  });
});
