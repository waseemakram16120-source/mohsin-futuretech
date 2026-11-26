import { describe, expect, it } from "vitest";
import { withTx, type Db } from "./helpers";

async function walletOrder(db: Db, userId: string | null = null) {
  const v = await db.variantWithStock(3);
  return db.placeOrder({ userId, items: [{ variant_id: v.id, quantity: 1 }], method: "easypaisa" });
}

async function submit(
  db: Db,
  order: { order_id: string; order_number: string },
  opts: { txn?: string; phone?: string | null; userId?: string | null; path?: string } = {},
) {
  await db.as("service_role");
  return db.query<{ r: Record<string, unknown> }>(
    "select public.submit_payment_evidence($1, $2, $3, $4, $5, $6) as r",
    [
      order.order_number,
      opts.userId ?? null,
      opts.phone === undefined ? "03001234567" : opts.phone,
      opts.txn ?? "EP12345678",
      opts.path ?? `${order.order_id}/receipt-1.jpg`,
      "Paid from my account",
    ],
  );
}

async function latestPaymentId(db: Db, orderId: string) {
  await db.asOwner();
  const row = await db.one<{ id: string }>(
    "select id from public.payments where order_id = $1 order by seq desc limit 1",
    [orderId],
  );
  return row.id;
}

describe("payment evidence", () => {
  it("guest submits a Transaction ID + receipt with the delivery phone → Pending Verification", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const res = await submit(db, order, { phone: "+92 300 1234567" });
      expect(res.rows[0].r).toEqual({ order_number: order.order_number, payment_status: "pending_verification" });

      await db.asOwner();
      const o = await db.one<{ payment_status: string }>(
        "select payment_status from public.orders where id = $1",
        [order.order_id],
      );
      expect(o.payment_status).toBe("pending_verification");
      // The record created at checkout is completed (no duplicate rows).
      const rows = await db.rows<{ status: string; transaction_id: string | null; receipt_path: string }>(
        "select status, transaction_id, receipt_path from public.payments where order_id = $1",
        [order.order_id],
      );
      expect(rows).toEqual([
        { status: "pending_verification", transaction_id: "EP12345678", receipt_path: `${order.order_id}/receipt-1.jpg` },
      ]);
    });
  });

  it("the signed-in owner can submit without the phone", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const order = await walletOrder(db, alice);
      const res = await submit(db, order, { phone: null, userId: alice });
      expect(res.rows[0].r).toMatchObject({ payment_status: "pending_verification" });
    });
  });

  it("refuses wrong phone, COD orders, bad IDs, bad paths and double submissions", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const stranger = await db.createUser();

      const call = (args: unknown[]) =>
        db.fails("select public.submit_payment_evidence($1, $2, $3, $4, $5, $6)", args);
      await db.as("service_role");
      const base = [order.order_number, null, "03001234567", "EP12345678", `${order.order_id}/r.png`, null];

      expect((await call([base[0], null, "03119999999", ...base.slice(3)])).message).toBe("order_not_found");
      expect((await call([base[0], stranger, null, ...base.slice(3)])).message).toBe("order_not_found");
      expect((await call(["MF-000000-99999", ...base.slice(1)])).message).toBe("order_not_found");
      expect((await call([...base.slice(0, 3), "abc", ...base.slice(4)])).message).toBe("invalid_transaction_id");
      expect((await call([...base.slice(0, 4), "other-order/r.png", null])).message).toBe("invalid_receipt");
      expect((await call([...base.slice(0, 4), `${order.order_id}/r.gif`, null])).message).toBe("invalid_receipt");

      await submit(db, order);
      await db.as("service_role");
      expect((await call(base)).message).toBe("evidence_already_submitted");

      const v = await db.variantWithStock(3);
      const cod = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "cod" });
      await db.as("service_role");
      expect(
        (await call([cod.order_number, null, "03001234567", "EP12345678", `${cod.order_id}/r.png`, null])).message,
      ).toBe("cod_no_evidence");
    });
  });

  it("one Transaction ID cannot back two orders", async () => {
    await withTx(async (db) => {
      const a = await walletOrder(db);
      const b = await walletOrder(db);
      await submit(db, a, { txn: "TXN999888" });
      await db.as("service_role");
      const err = await db.fails("select public.submit_payment_evidence($1, null, $2, $3, $4, null)", [
        b.order_number,
        "03001234567",
        "txn999888",
        `${b.order_id}/r.webp`,
      ]);
      expect(err.message).toBe("transaction_id_used");
    });
  });
});

describe("admin payment review", () => {
  it("customers cannot review payments", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const order = await walletOrder(db, alice);
      await submit(db, order);
      const paymentId = await latestPaymentId(db, order.order_id);
      await db.as("authenticated", alice);
      const err = await db.fails("select public.review_payment($1, 'approve', null)", [paymentId]);
      expect(err.message).toBe("forbidden");
    });
  });

  it("approve → payment Approved and a pending order becomes Confirmed (with history)", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const order = await walletOrder(db);
      await submit(db, order);
      const paymentId = await latestPaymentId(db, order.order_id);

      await db.as("authenticated", admin);
      const res = await db.one<{ r: Record<string, unknown> }>(
        "select public.review_payment($1, 'approve', 'Matched in EasyPaisa app') as r",
        [paymentId],
      );
      expect(res.r).toEqual({ payment_id: paymentId, payment_status: "approved" });

      await db.asOwner();
      const o = await db.one<{ status: string; payment_status: string }>(
        "select status, payment_status from public.orders where id = $1",
        [order.order_id],
      );
      expect(o).toEqual({ status: "confirmed", payment_status: "approved" });
      const p = await db.one<{ reviewed_by: string; review_note: string }>(
        "select reviewed_by, review_note from public.payments where id = $1",
        [paymentId],
      );
      expect(p).toEqual({ reviewed_by: admin, review_note: "Matched in EasyPaisa app" });
      const history = await db.rows<{ to_status: string; changed_by: string }>(
        "select to_status, changed_by from public.order_status_history where order_id = $1 order by created_at",
        [order.order_id],
      );
      expect(history.at(-1)).toEqual({ to_status: "confirmed", changed_by: admin });

      // Approving twice is not allowed.
      await db.as("authenticated", admin);
      expect((await db.fails("select public.review_payment($1, 'approve', null)", [paymentId])).message).toBe(
        "invalid_payment_action",
      );
    });
  });

  it("reject needs a reason, keeps the order on hold, and allows a corrected resubmission", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const order = await walletOrder(db);
      await submit(db, order, { txn: "WRONG12345" });
      const first = await latestPaymentId(db, order.order_id);

      await db.as("authenticated", admin);
      expect((await db.fails("select public.review_payment($1, 'reject', '  ')", [first])).message).toBe(
        "review_note_required",
      );
      await db.query("select public.review_payment($1, 'reject', 'Amount does not match')", [first]);

      await db.asOwner();
      const held = await db.one<{ status: string; payment_status: string }>(
        "select status, payment_status from public.orders where id = $1",
        [order.order_id],
      );
      expect(held).toEqual({ status: "pending", payment_status: "rejected" });

      // The rejected transaction ID is released, so a corrected one can be sent.
      const res = await submit(db, order, { txn: "RIGHT12345", path: `${order.order_id}/receipt-2.png` });
      expect(res.rows[0].r).toMatchObject({ payment_status: "pending_verification" });

      await db.asOwner();
      const records = await db.rows<{ status: string; transaction_id: string }>(
        "select status, transaction_id from public.payments where order_id = $1 order by seq",
        [order.order_id],
      );
      expect(records).toEqual([
        { status: "rejected", transaction_id: "WRONG12345" },
        { status: "pending_verification", transaction_id: "RIGHT12345" },
      ]);

      // The old (rejected) record can no longer be reviewed.
      await db.as("authenticated", admin);
      expect((await db.fails("select public.review_payment($1, 'approve', null)", [first])).message).toBe(
        "payment_superseded",
      );
    });
  });

  it("COD: admin marks the payment as Paid after delivery", async () => {
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
      const o = await db.one<{ payment_status: string }>(
        "select payment_status from public.orders where id = $1",
        [order.order_id],
      );
      expect(o.payment_status).toBe("paid");
    });
  });

  it("customers see their own payment status and review reason via get_order_details", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const order = await walletOrder(db);
      await submit(db, order);
      const paymentId = await latestPaymentId(db, order.order_id);
      await db.as("authenticated", admin);
      await db.query("select public.review_payment($1, 'reject', 'Screenshot is blurry')", [paymentId]);

      await db.as("service_role");
      const details = await db.one<{ d: Record<string, unknown> | null }>(
        "select public.get_order_details($1, null, '03001234567') as d",
        [order.order_number],
      );
      const d = details.d as { payment_status: string; payments: Array<Record<string, unknown>>; user_id?: unknown };
      expect(d.payment_status).toBe("rejected");
      expect(d.payments.at(-1)).toMatchObject({ status: "rejected", review_note: "Screenshot is blurry", has_receipt: true });
      expect(d).not.toHaveProperty("user_id");
      expect(JSON.stringify(d)).not.toContain("receipt_path");

      const none = await db.one<{ d: unknown }>(
        "select public.get_order_details($1, null, '03119999999') as d",
        [order.order_number],
      );
      expect(none.d).toBeNull();
    });
  });
});
