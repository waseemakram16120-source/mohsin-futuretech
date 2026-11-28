import { describe, expect, it } from "vitest";
import { withTx } from "./helpers";

describe("admin_overview (dashboard)", () => {
  it("is refused to guests and customers", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      await db.as("anon");
      expect((await db.fails("select public.admin_overview()")).code).toBe("42501");
      await db.as("authenticated", alice);
      expect((await db.fails("select public.admin_overview()")).message).toBe("forbidden");
    });
  });

  it("counts orders, sales, verifications and stock from the whole table", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      await db.as("authenticated", admin);
      const before = (await db.one<{ o: Record<string, number | string> }>("select public.admin_overview() as o")).o;

      const v = await db.variantWithStock(5);
      const cod = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "cod" });
      const wallet = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "easypaisa" });
      await db.as("service_role");
      await db.query("select public.submit_payment_evidence($1, null, '03001234567', 'EP90001111', $2, null)", [
        wallet.order_number,
        `${wallet.order_id}/receipt-1-abc.png`,
      ]);
      const cancelled = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "cod" });
      await db.as("authenticated", admin);
      await db.query("select public.update_order_status($1, 'cancelled', null)", [cancelled.order_id]);

      const after = (await db.one<{ o: Record<string, number | string> }>("select public.admin_overview() as o")).o;
      expect(Number(after.orders_total) - Number(before.orders_total)).toBe(3);
      expect(Number(after.orders_today) - Number(before.orders_today)).toBe(3);
      expect(Number(after.orders_pending) - Number(before.orders_pending)).toBe(2);
      expect(Number(after.payments_to_verify) - Number(before.payments_to_verify)).toBe(1);
      // Cancelled orders are not sales.
      expect(Number(after.sales_total) - Number(before.sales_total)).toBeCloseTo(Number(cod.total_amount) + Number(wallet.total_amount));
      expect(Number(after.revenue_collected)).toBe(Number(before.revenue_collected));
    });
  });
});
