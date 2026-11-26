import { describe, expect, it } from "vitest";
import { withTx, type Db } from "./helpers";

async function latestPaymentId(db: Db, orderId: string) {
  await db.asOwner();
  const row = await db.one<{ id: string }>(
    "select id from public.payments where order_id = $1 order by seq desc limit 1",
    [orderId],
  );
  return row.id;
}

describe("manual payment evidence (retired)", () => {
  it("the server can no longer submit receipts: a screenshot must never lead to paid", async () => {
    await withTx(async (db) => {
      const v = await db.variantWithStock(2);
      const order = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "jazzcash" });
      await db.as("service_role");
      const err = await db.fails("select public.submit_payment_evidence($1, null, '03001234567', 'EP12345678', $2, null)", [
        order.order_number,
        `${order.order_id}/r.jpg`,
      ]);
      expect(err.code).toBe("42501");
    });
  });

  it("new NayaPay orders are refused; COD, JazzCash and Easypaisa are offered", async () => {
    await withTx(async (db) => {
      const v = await db.variantWithStock(4);
      for (const method of ["cod", "jazzcash", "easypaisa"] as const) {
        const order = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method });
        expect(order.payment_status).toBe(method === "cod" ? "due" : "awaiting_payment");
      }
      await db.as("service_role");
      const err = await db.fails("select public.place_order(null, $1, $2, 'nayapay', null)", [
        { name: "Ali Khan", phone: "03001234567", address: "House 1, Street 2, Area", city: "Karachi" },
        JSON.stringify([{ variant_id: v.id, quantity: 1 }]),
      ]);
      expect(err.message).toBe("payment_method_not_offered");
    });
  });
});

describe("admin payment review (COD)", () => {
  it("customers cannot review payments", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const v = await db.variantWithStock(2);
      const order = await db.placeOrder({ userId: alice, items: [{ variant_id: v.id, quantity: 1 }], method: "cod" });
      const paymentId = await latestPaymentId(db, order.order_id);
      await db.as("authenticated", alice);
      const err = await db.fails("select public.review_payment($1, 'mark_paid', null)", [paymentId]);
      expect(err.message).toBe("forbidden");
    });
  });

  it("admin marks a COD payment as Paid after delivery; it cannot be 'approved'", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const v = await db.variantWithStock(2);
      const order = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "cod" });
      const paymentId = await latestPaymentId(db, order.order_id);
      await db.as("authenticated", admin);
      expect((await db.fails("select public.review_payment($1, 'approve', null)", [paymentId])).message).toBe(
        "invalid_payment_action",
      );
      await db.query("select public.review_payment($1, 'mark_paid', 'Cash received by rider')", [paymentId]);
      await db.asOwner();
      const o = await db.one<{ payment_status: string }>("select payment_status from public.orders where id = $1", [order.order_id]);
      expect(o.payment_status).toBe("paid");
    });
  });

  it("admins cannot mark an unpaid gateway order as paid", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const v = await db.variantWithStock(2);
      const order = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "easypaisa" });
      const paymentId = await latestPaymentId(db, order.order_id);
      await db.as("authenticated", admin);
      for (const action of ["approve", "mark_paid"]) {
        expect((await db.fails("select public.review_payment($1, $2, null)", [paymentId, action])).message).toBe(
          "invalid_payment_action",
        );
      }
    });
  });
});
