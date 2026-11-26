/**
 * Payment gateway core (migration 0006) — spec §13 scenarios at the
 * database level: idempotent initiation, verified transitions, replay and
 * duplicate protection, amount/currency matching, late callbacks, double
 * charges and concurrency.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, withTx, type Db } from "./helpers";

const ref = () => randomBytes(10).toString("hex").toUpperCase(); // 20 chars
const key = () => `test:${randomBytes(12).toString("hex")}`;

interface Started {
  attempt_id: string;
  reference: string;
  amount_minor: number;
  currency: string;
  reused: boolean;
}

async function walletOrder(db: Db, method: "jazzcash" | "easypaisa" = "jazzcash") {
  const v = await db.variantWithStock(3);
  return db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method });
}

async function start(db: Db, orderId: string, provider = "jazzcash", reference = ref()) {
  await db.as("service_role");
  const { r } = await db.one<{ r: Started }>("select public.start_payment_attempt($1, $2, $3, 30) as r", [orderId, provider, reference]);
  return r;
}

async function apply(
  db: Db,
  a: {
    reference: string;
    result: string;
    provider?: string;
    verified?: boolean;
    txn?: string | null;
    amount?: number | null;
    currency?: string | null;
    dedupe?: string;
    event?: string;
  },
) {
  await db.as("service_role");
  const { r } = await db.one<{ r: { outcome: string; status: string; reason: string | null } }>(
    "select public.apply_payment_event($1, $2, $3, $4, $5, $6, $7, $8, $9, null, '{}'::jsonb) as r",
    [a.provider ?? "jazzcash", a.reference, a.event ?? "callback", a.dedupe ?? key(), a.verified ?? true, a.result, a.txn ?? null, a.amount ?? null, a.currency ?? null],
  );
  return r;
}

async function state(db: Db, orderId: string) {
  await db.asOwner();
  return db.one<{ payment_status: string; status: string; attempts: string[]; history: number; payment_row: string }>(
    `select o.payment_status, o.status,
            array(select a.status::text from public.payment_attempts a where a.order_id = o.id order by a.created_at) as attempts,
            (select count(*)::int from public.order_status_history h where h.order_id = o.id) as history,
            (select p.status::text from public.payments p where p.order_id = o.id order by p.seq desc limit 1) as payment_row
       from public.orders o where o.id = $1`,
    [orderId],
  );
}

describe("start_payment_attempt", () => {
  it("prices the attempt from the order in paisa (PKR) and is idempotent", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const a = await start(db, order.order_id);
      expect(a).toMatchObject({ amount_minor: Math.round(order.total_amount * 100), currency: "PKR", reused: false });
      // Double click / retry: same attempt back, no second charge.
      const b = await start(db, order.order_id);
      expect(b).toMatchObject({ reference: a.reference, reused: true });
      expect((await state(db, order.order_id)).attempts).toEqual(["created"]);
    });
  });

  it("refuses COD, paid, cancelled and provider-mismatched orders", async () => {
    await withTx(async (db) => {
      const v = await db.variantWithStock(4);
      const cod = await db.placeOrder({ items: [{ variant_id: v.id, quantity: 1 }], method: "cod" });
      await db.as("service_role");
      const call = (orderId: string, provider: string) =>
        db.fails("select public.start_payment_attempt($1, $2, $3, 30)", [orderId, provider, ref()]);
      expect((await call(cod.order_id, "jazzcash")).message).toBe("cod_order");

      const ep = await walletOrder(db, "easypaisa");
      await db.as("service_role");
      expect((await call(ep.order_id, "jazzcash")).message).toBe("provider_mismatch");

      const paid = await walletOrder(db);
      const a = await start(db, paid.order_id);
      await apply(db, { reference: a.reference, result: "paid", txn: "T1", amount: a.amount_minor, currency: "PKR" });
      await db.as("service_role");
      expect((await call(paid.order_id, "jazzcash")).message).toBe("already_paid");

      const cancelled = await walletOrder(db);
      await db.asOwner();
      await db.query("update public.orders set status = 'cancelled' where id = $1", [cancelled.order_id]);
      await db.as("service_role");
      expect((await call(cancelled.order_id, "jazzcash")).message).toBe("order_not_payable");
      expect((await db.fails("select public.start_payment_attempt(gen_random_uuid(), 'jazzcash', $1, 30)", [ref()])).message).toBe("order_not_found");
    });
  });

  it("an attempt already sent to the provider blocks a second charge until reconciled", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const a = await start(db, order.order_id);
      await apply(db, { reference: a.reference, result: "pending", event: "initiate" });
      await db.as("service_role");
      const err = await db.fails("select public.start_payment_attempt($1, 'jazzcash', $2, 30)", [order.order_id, ref()]);
      expect(err.message).toBe("payment_in_progress");
    });
  });

  it("after a verified failure the customer can try again with a new attempt", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const a = await start(db, order.order_id);
      await apply(db, { reference: a.reference, result: "failed" });
      const b = await start(db, order.order_id);
      expect(b.reference).not.toBe(a.reference);
      const s = await state(db, order.order_id);
      expect(s.payment_status).toBe("awaiting_payment");
      expect([...s.attempts].sort()).toEqual(["created", "failed"]);
    });
  });
});

describe("apply_payment_event — verified success", () => {
  it("records any provider transaction id format without failing", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const a = await start(db, order.order_id);
      const r = await apply(db, { reference: a.reference, result: "paid", txn: "T1/ä:9", amount: a.amount_minor, currency: "PKR" });
      expect(r.outcome).toBe("applied");
      await db.asOwner();
      const row = await db.one<{ provider_txn_id: string }>("select provider_txn_id from public.payment_attempts where id = $1", [a.attempt_id]);
      expect(row.provider_txn_id).toBe("T1/ä:9");
    });
  });

  it("marks the attempt, payment and order paid, confirms the order once", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db, "easypaisa");
      const a = await start(db, order.order_id, "easypaisa");
      const r = await apply(db, { provider: "easypaisa", reference: a.reference, result: "paid", txn: "EP-998877", amount: a.amount_minor, currency: "pkr" });
      expect(r).toMatchObject({ outcome: "applied", status: "paid" });
      const s = await state(db, order.order_id);
      expect(s).toMatchObject({ payment_status: "paid", status: "confirmed", attempts: ["paid"], payment_row: "paid", history: 2 });
      await db.asOwner();
      const p = await db.one<{ transaction_id: string }>("select transaction_id from public.payments where order_id = $1", [order.order_id]);
      expect(p.transaction_id).toBe("EP-998877");
    });
  });

  it("pending and processing keep the order unpaid", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const a = await start(db, order.order_id);
      await apply(db, { reference: a.reference, result: "pending" });
      await apply(db, { reference: a.reference, result: "processing" });
      expect(await state(db, order.order_id)).toMatchObject({ payment_status: "awaiting_payment", status: "pending", attempts: ["processing"] });
    });
  });

  it("failed, cancelled and expired never mark anything paid", async () => {
    await withTx(async (db) => {
      for (const result of ["failed", "cancelled", "expired"]) {
        const order = await walletOrder(db);
        const a = await start(db, order.order_id);
        expect((await apply(db, { reference: a.reference, result })).outcome).toBe("applied");
        expect(await state(db, order.order_id)).toMatchObject({ payment_status: "awaiting_payment", status: "pending", attempts: [result] });
      }
    });
  });
});

describe("apply_payment_event — rejections (no side effects)", () => {
  it("rejects unverified, unknown, unrecognised, mismatched and incomplete messages", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const a = await start(db, order.order_id);
      const good = { reference: a.reference, result: "paid", txn: "TX1", amount: a.amount_minor, currency: "PKR" };
      const cases: Array<[Record<string, unknown>, string]> = [
        [{ verified: false }, "verification_failed"],
        [{ reference: "UNKNOWNREF12345" }, "unknown_reference"],
        [{ provider: "easypaisa" }, "unknown_reference"], // right reference, wrong provider
        [{ result: "SUCCESSFUL!!" }, "unrecognised_status"],
        [{ txn: null }, "missing_provider_txn_id"],
        [{ amount: a.amount_minor - 1 }, "amount_mismatch"],
        [{ amount: a.amount_minor + 100 }, "amount_mismatch"],
        [{ amount: null }, "amount_mismatch"],
        [{ currency: "USD" }, "currency_mismatch"],
        [{ currency: null }, "currency_mismatch"],
      ];
      for (const [override, reason] of cases) {
        const r = await apply(db, { ...good, ...override } as Parameters<typeof apply>[1]);
        expect({ override, outcome: r.outcome, reason: r.reason }).toEqual({ override, outcome: "rejected", reason });
      }
      expect(await state(db, order.order_id)).toMatchObject({ payment_status: "awaiting_payment", attempts: ["created"] });
      await db.asOwner();
      const rejected = await db.one<{ n: number }>(
        "select count(*)::int as n from public.payment_events where outcome = 'rejected' and (attempt_id = $1 or attempt_id is null)",
        [a.attempt_id],
      );
      expect(rejected.n).toBeGreaterThanOrEqual(cases.length);
    });
  });
});

describe("replay, duplicates and late events", () => {
  it("the same callback twice is a duplicate with no second side effect", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const a = await start(db, order.order_id);
      const msg = { reference: a.reference, result: "paid", txn: "TXDUP", amount: a.amount_minor, currency: "PKR", dedupe: key() };
      expect((await apply(db, msg)).outcome).toBe("applied");
      const before = await state(db, order.order_id);
      expect(await apply(db, msg)).toMatchObject({ outcome: "duplicate", reason: "duplicate_event" });
      expect(await state(db, order.order_id)).toEqual(before);
      // The browser return after the server callback: same truth, no change.
      expect(await apply(db, { ...msg, dedupe: key(), event: "return" })).toMatchObject({ outcome: "ignored", reason: "no_change" });
    });
  });

  it("a late failure after a verified success never downgrades it", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const a = await start(db, order.order_id);
      await apply(db, { reference: a.reference, result: "paid", txn: "TXOK", amount: a.amount_minor, currency: "PKR" });
      for (const result of ["failed", "cancelled", "expired", "pending"]) {
        expect(await apply(db, { reference: a.reference, result })).toMatchObject({ outcome: "ignored", reason: "transition_not_allowed" });
      }
      expect(await state(db, order.order_id)).toMatchObject({ payment_status: "paid", attempts: ["paid"] });
    });
  });

  it("one provider transaction cannot pay two orders", async () => {
    await withTx(async (db) => {
      const o1 = await walletOrder(db);
      const o2 = await walletOrder(db);
      const a1 = await start(db, o1.order_id);
      const a2 = await start(db, o2.order_id);
      await apply(db, { reference: a1.reference, result: "paid", txn: "SAME-TXN", amount: a1.amount_minor, currency: "PKR" });
      const r = await apply(db, { reference: a2.reference, result: "paid", txn: "SAME-TXN", amount: a2.amount_minor, currency: "PKR" });
      expect(r).toMatchObject({ outcome: "rejected", reason: "provider_txn_reused" });
      expect(await state(db, o2.order_id)).toMatchObject({ payment_status: "awaiting_payment" });
    });
  });

  it("a verified success after expiry is recorded (money was taken)", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const a = await start(db, order.order_id);
      await apply(db, { reference: a.reference, result: "expired" });
      const r = await apply(db, { reference: a.reference, result: "paid", txn: "LATE1", amount: a.amount_minor, currency: "PKR", event: "status_inquiry" });
      expect(r.outcome).toBe("applied");
      expect(await state(db, order.order_id)).toMatchObject({ payment_status: "paid" });
    });
  });

  it("a second successful charge on a paid order is kept and flagged for refund review", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const a = await start(db, order.order_id);
      await apply(db, { reference: a.reference, result: "failed" });
      const b = await start(db, order.order_id);
      await apply(db, { reference: b.reference, result: "paid", txn: "B-OK", amount: b.amount_minor, currency: "PKR" });
      // The provider later reports attempt A as paid too.
      const r = await apply(db, { reference: a.reference, result: "paid", txn: "A-LATE", amount: a.amount_minor, currency: "PKR", event: "status_inquiry" });
      expect(r).toMatchObject({ outcome: "applied", reason: "duplicate_charge_needs_review" });
      await db.asOwner();
      const flagged = await db.rows("select id from public.payment_attempts where order_id = $1 and needs_review", [order.order_id]);
      expect(flagged).toHaveLength(1);
      expect((await state(db, order.order_id)).history).toBe(2); // confirmed once
    });
  });

  it("payment for a cancelled order is recorded and flagged, the order stays cancelled", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const a = await start(db, order.order_id);
      await apply(db, { reference: a.reference, result: "pending" });
      await db.asOwner();
      await db.query("update public.orders set status = 'cancelled' where id = $1", [order.order_id]);
      const r = await apply(db, { reference: a.reference, result: "paid", txn: "AFTERCANCEL", amount: a.amount_minor, currency: "PKR" });
      expect(r.reason).toBe("paid_after_cancellation_needs_review");
      expect(await state(db, order.order_id)).toMatchObject({ status: "cancelled", payment_status: "paid" });
    });
  });
});

describe("reconciliation", () => {
  it("expires never-sent attempts and lists uncertain ones for a status check", async () => {
    await withTx(async (db) => {
      const o1 = await walletOrder(db);
      const o2 = await walletOrder(db);
      const a1 = await start(db, o1.order_id);
      const a2 = await start(db, o2.order_id);
      await apply(db, { reference: a2.reference, result: "pending" });
      await db.asOwner();
      await db.query("update public.payment_attempts set expires_at = now() - interval '1 minute' where reference in ($1, $2)", [a1.reference, a2.reference]);
      await db.as("service_role");
      const list = await db.rows<{ reference: string; status: string }>("select reference, status::text from public.payment_attempts_to_reconcile(50)");
      expect(list.map((l) => l.reference)).toContain(a2.reference);
      expect(list.map((l) => l.reference)).not.toContain(a1.reference);
      expect((await state(db, o1.order_id)).attempts).toEqual(["expired"]);
      expect((await state(db, o2.order_id)).attempts).toEqual(["pending"]); // uncertain: not assumed failed
    });
  });
});

describe("access control", () => {
  it("only the server can start attempts or apply events; only admins read the ledger", async () => {
    await withTx(async (db) => {
      const order = await walletOrder(db);
      const a = await start(db, order.order_id);
      const alice = await db.createUser();
      const admin = await db.createUser({ admin: true });
      for (const role of ["anon", "authenticated"] as const) {
        await db.as(role, role === "authenticated" ? alice : undefined);
        expect((await db.fails("select public.start_payment_attempt($1, 'jazzcash', $2, 30)", [order.order_id, ref()])).code).toBe("42501");
        expect(
          (await db.fails("select public.apply_payment_event('jazzcash', $1, 'callback', $2, true, 'paid', 'X', 1, 'PKR', null, '{}'::jsonb)", [a.reference, key()])).code,
        ).toBe("42501");
      }
      await db.as("authenticated", alice);
      expect(await db.rows("select id from public.payment_attempts")).toHaveLength(0);
      expect((await db.fails("update public.payment_attempts set status = 'paid'")).code).toBe("42501");
      await db.as("anon");
      expect((await db.fails("select id from public.payment_attempts")).code).toBe("42501");
      await db.as("authenticated", admin);
      expect((await db.rows("select id from public.payment_attempts where id = $1", [a.attempt_id])).length).toBe(1);
    });
  });
});

describe("concurrency (committed data)", () => {
  let orderId = "";
  let reference = "";
  let amount = 0;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      const { rows: v } = await client.query<{ id: string }>(
        `select v.id from public.product_variants v join public.products p on p.id = v.product_id
          where p.is_active and v.is_active and v.stock_quantity >= 3 order by v.sku limit 1`,
      );
      await client.query("set role service_role");
      const { rows } = await client.query<{ r: { order_id: string } }>("select public.place_order(null, $1, $2, 'jazzcash', null) as r", [
        { name: "Race Test", phone: "03001234567", address: "House 1, Street 2, Area", city: "Karachi" },
        JSON.stringify([{ variant_id: v[0].id, quantity: 1 }]),
      ]);
      orderId = rows[0].r.order_id;
      reference = ref();
      const { rows: s } = await client.query<{ r: Started }>("select public.start_payment_attempt($1, 'jazzcash', $2, 30) as r", [orderId, reference]);
      amount = s[0].r.amount_minor;
    } finally {
      await client.query("reset role");
      client.release();
    }
  });

  afterAll(async () => {
    // Put the stock back and remove the test order and its ledger rows.
    await pool.query(
      `update public.product_variants v set stock_quantity = v.stock_quantity + i.quantity
         from public.order_items i where i.order_id = $1 and i.variant_id = v.id`,
      [orderId],
    );
    await pool.query("delete from public.payment_events where attempt_id in (select id from public.payment_attempts where order_id = $1)", [orderId]);
    await pool.query("delete from public.payment_attempts where order_id = $1", [orderId]);
    await pool.query("delete from public.orders where id = $1", [orderId]);
  });

  it("two success callbacks at the same moment apply exactly once", async () => {
    const run = async (dedupe: string) => {
      const c = await pool.connect();
      try {
        await c.query("begin");
        await c.query("set local role service_role");
        const { rows } = await c.query<{ r: { outcome: string } }>(
          "select public.apply_payment_event('jazzcash', $1, 'callback', $2, true, 'paid', 'RACE-TXN', $3, 'PKR', null, '{}'::jsonb) as r",
          [reference, dedupe, amount],
        );
        await c.query("select pg_sleep(0.2)");
        await c.query("commit");
        return rows[0].r.outcome;
      } finally {
        c.release();
      }
    };
    const outcomes = await Promise.all([run(key()), run(key()), run(key())]);
    expect(outcomes.filter((o) => o === "applied")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "ignored")).toHaveLength(2);
    const { rows } = await pool.query<{ n: number }>(
      "select count(*)::int as n from public.order_status_history where order_id = $1 and to_status = 'confirmed'",
      [orderId],
    );
    expect(rows[0].n).toBe(1);
  });
});

describe("state machine parity", () => {
  it("the database transition table matches src/lib/payments/status.ts", async () => {
    const { ATTEMPT_STATUSES, canTransition } = await import("@/lib/payments/status");
    await withTx(async (db) => {
      for (const from of ATTEMPT_STATUSES) {
        for (const to of ATTEMPT_STATUSES) {
          const { ok } = await db.one<{ ok: boolean }>("select public.payment_attempt_can_transition($1, $2) as ok", [from, to]);
          expect({ from, to, ok }).toEqual({ from, to, ok: canTransition(from, to) });
        }
      }
    });
  });
});
