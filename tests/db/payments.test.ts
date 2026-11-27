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

const RECEIPT = (orderId: string) => `${orderId}/receipt-1-abc.png`;

async function submit(db: Db, orderNumber: string, txn: string, path: string) {
  await db.as("service_role");
  return db.one<{ r: { payment_status: string } }>(
    "select public.submit_payment_evidence($1, null, '03001234567', $2, $3, null) as r",
    [orderNumber, txn, path],
  );
}

describe("manual payment evidence (proposal §4)", () => {
  it("evidence moves a wallet payment to Pending Verification and never approves the order", async () => {
    await withTx(async (db) => {
      const v = await db.variantWithStock(2);
      const order = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "easypaisa" });
      const { r } = await submit(db, order.order_number, "EP12345678", RECEIPT(order.order_id));
      expect(r.payment_status).toBe("pending_verification");
      await db.asOwner();
      const o = await db.one<{ payment_status: string; status: string }>("select payment_status, status from public.orders where id = $1", [order.order_id]);
      expect(o).toEqual({ payment_status: "pending_verification", status: "pending" });
      const p = await db.one<{ status: string; transaction_id: string; receipt_path: string; amount: string }>(
        "select status, transaction_id, receipt_path, amount::text from public.payments where order_id = $1",
        [order.order_id],
      );
      expect(p).toMatchObject({ status: "pending_verification", transaction_id: "EP12345678", receipt_path: RECEIPT(order.order_id) });
      expect(Number(p.amount)).toBe(Number(order.total_amount));
    });
  });

  it("browsers cannot call it; bad ids, foreign receipt paths and COD are refused", async () => {
    await withTx(async (db) => {
      const v = await db.variantWithStock(3);
      const order = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "jazzcash" });
      for (const role of ["anon", "authenticated"] as const) {
        await db.as(role);
        const err = await db.fails("select public.submit_payment_evidence($1, null, '03001234567', 'JC12345678', $2, null)", [
          order.order_number,
          RECEIPT(order.order_id),
        ]);
        expect(err.code).toBe("42501");
      }
      await db.as("service_role");
      const cases: Array<[string, string, string]> = [
        ["bad id!", RECEIPT(order.order_id), "invalid_transaction_id"],
        ["JC12345678", "someone-else/receipt.png", "invalid_receipt"],
        ["JC12345678", `${order.order_id}/receipt.pdf`, "invalid_receipt"],
        ["JC12345678", `${order.order_id}/../x.png`, "invalid_receipt"],
      ];
      for (const [txn, path, code] of cases) {
        const err = await db.fails("select public.submit_payment_evidence($1, null, '03001234567', $2, $3, null)", [order.order_number, txn, path]);
        expect(err.message).toBe(code);
      }
      const cod = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "cod" });
      await db.as("service_role");
      expect(
        (await db.fails("select public.submit_payment_evidence($1, null, '03001234567', 'JC12345678', $2, null)", [cod.order_number, RECEIPT(cod.order_id)])).message,
      ).toBe("cod_no_evidence");
    });
  });

  it("one submission at a time; a Transaction ID backs one live submission; rejection allows a new one", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const v = await db.variantWithStock(3);
      const a = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "easypaisa" });
      const b = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "easypaisa" });
      await submit(db, a.order_number, "EP11112222", RECEIPT(a.order_id));
      await db.as("service_role");
      expect((await db.fails("select public.submit_payment_evidence($1, null, '03001234567', 'EP99998888', $2, null)", [a.order_number, RECEIPT(a.order_id)])).message).toBe(
        "evidence_already_submitted",
      );
      expect((await db.fails("select public.submit_payment_evidence($1, null, '03001234567', 'ep11112222', $2, null)", [b.order_number, RECEIPT(b.order_id)])).message).toBe(
        "transaction_id_used",
      );

      const paymentId = await latestPaymentId(db, a.order_id);
      await db.as("authenticated", admin);
      expect((await db.fails("select public.review_payment($1, 'reject', null)", [paymentId])).message).toBe("review_note_required");
      await db.query("select public.review_payment($1, 'reject', 'Amount does not match')", [paymentId]);

      // Corrected evidence is a NEW record; the rejected one stays as history.
      await submit(db, a.order_number, "EP11112222", RECEIPT(a.order_id));
      await db.asOwner();
      const rows = await db.rows<{ status: string }>("select status from public.payments where order_id = $1 order by seq", [a.order_id]);
      expect(rows.map((r) => r.status)).toEqual(["rejected", "pending_verification"]);

      // Approval is the only way forward, and it confirms the pending order.
      const latest = await latestPaymentId(db, a.order_id);
      await db.as("authenticated", admin);
      await db.query("select public.review_payment($1, 'approve', null)", [latest]);
      await db.asOwner();
      const o = await db.one<{ payment_status: string; status: string }>("select payment_status, status from public.orders where id = $1", [a.order_id]);
      expect(o).toEqual({ payment_status: "approved", status: "confirmed" });
    });
  });

  it("manual evidence and gateway charges never overlap on one order", async () => {
    await withTx(async (db) => {
      const v = await db.variantWithStock(3);
      // Evidence under review → no gateway attempt can start.
      const a = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "easypaisa" });
      await submit(db, a.order_number, "EP33334444", RECEIPT(a.order_id));
      await db.as("service_role");
      expect((await db.fails("select public.start_payment_attempt($1, 'easypaisa', 'REFAAAAAAAAAAAAAAAAA', 30)", [a.order_id])).message).toBe(
        "evidence_under_review",
      );

      // Gateway charge pending at the provider → evidence is refused.
      const b = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "easypaisa" });
      await db.as("service_role");
      await db.query("select public.start_payment_attempt($1, 'easypaisa', 'REFBBBBBBBBBBBBBBBBB', 30)", [b.order_id]);
      await db.query(
        "select public.apply_payment_event('easypaisa', 'REFBBBBBBBBBBBBBBBBB', 'initiate', 'init:test:b', true, 'pending')",
      );
      expect((await db.fails("select public.submit_payment_evidence($1, null, '03001234567', 'EP55556666', $2, null)", [b.order_number, RECEIPT(b.order_id)])).message).toBe(
        "payment_in_progress",
      );
    });
  });

  it("order_payment_evidence exposes status and rejection reason, never the receipt path", async () => {
    await withTx(async (db) => {
      const v = await db.variantWithStock(2);
      const order = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "jazzcash" });
      await submit(db, order.order_number, "JC77778888", RECEIPT(order.order_id));
      await db.as("service_role");
      const { e } = await db.one<{ e: Record<string, unknown> }>("select public.order_payment_evidence($1) as e", [order.order_id]);
      expect(e).toMatchObject({ status: "pending_verification", transaction_id: "JC77778888", review_note: null });
      expect(Object.keys(e)).not.toContain("receipt_path");
    });
  });
});

describe("payment methods offered", () => {
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

  it("admins cannot approve or mark paid a wallet order with no evidence", async () => {
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
