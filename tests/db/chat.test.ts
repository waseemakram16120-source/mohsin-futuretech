import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTx, type Db } from "./helpers";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

async function start(db: Db, opts: { userId?: string | null; token?: string; name?: string; body?: string } = {}) {
  await db.as("service_role");
  const { r } = await db.one<{ r: { conversation_id: string } }>(
    "select public.chat_start($1, $2, $3, '0300 1234567', null, $4) as r",
    [opts.userId ?? null, opts.userId ? null : hash(opts.token ?? "guest-token"), opts.name ?? "Ayesha", opts.body ?? "Is size M available?"],
  );
  return r.conversation_id;
}

describe("live chat: access", () => {
  it("browsers cannot call the customer functions or write the tables", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      for (const role of ["anon", "authenticated"] as const) {
        await db.as(role, role === "authenticated" ? alice : undefined);
        expect((await db.fails("select public.chat_start(null, $1, 'X Y', null, null, 'hi')", [hash("t")])).code).toBe("42501");
        expect((await db.fails("select public.chat_customer_post(gen_random_uuid(), null, 'hi')")).code).toBe("42501");
        expect((await db.fails("select public.chat_customer_read(gen_random_uuid(), 0)")).code).toBe("42501");
        expect((await db.fails("insert into public.chat_messages (conversation_id, sender, body) values (gen_random_uuid(), 'admin', 'x')")).code).toBe("42501");
      }
      // Not even the server can bypass the summary bookkeeping.
      await db.as("service_role");
      expect((await db.fails("select public.chat_append(gen_random_uuid(), 'admin', null, 'x')")).code).toBe("42501");
    });
  });

  it("customers read only their own conversation; guests read nothing; admins read all", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const bob = await db.createUser();
      const admin = await db.createUser({ admin: true });
      const aliceConv = await start(db, { userId: alice });
      await start(db, { token: "guest-1", name: "Guest One" });

      await db.as("authenticated", alice);
      expect((await db.rows<{ id: string }>("select id from public.chat_conversations")).map((r) => r.id)).toEqual([aliceConv]);
      expect(await db.rows("select id from public.chat_messages")).toHaveLength(1);
      await db.as("authenticated", bob);
      expect(await db.rows("select id from public.chat_conversations")).toHaveLength(0);
      expect(await db.rows("select id from public.chat_messages")).toHaveLength(0);
      await db.as("anon");
      expect((await db.fails("select id from public.chat_conversations")).code).toBe("42501");
      await db.as("authenticated", admin);
      expect((await db.rows("select id from public.chat_conversations")).length).toBeGreaterThanOrEqual(2);
    });
  });

  it("only admins can reply, mark read or close", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const conv = await start(db, { userId: alice });
      await db.as("authenticated", alice);
      for (const sql of ["select public.chat_admin_reply($1, 'hi')", "select public.chat_admin_mark_read($1)", "select public.chat_admin_set_status($1, 'closed')"]) {
        expect((await db.fails(sql, [conv])).message).toBe("forbidden");
      }
    });
  });
});

describe("live chat: behaviour", () => {
  it("counts unread on each side, closes and reopens", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const conv = await start(db, { token: "g2" });
      await db.as("service_role");
      await db.query("select public.chat_customer_post($1, null, '  And in black?  ')", [conv]);

      await db.asOwner();
      let c = await db.one<{ unread_for_admin: number; unread_for_customer: number; last_message_preview: string; last_sender: string }>(
        "select unread_for_admin, unread_for_customer, last_message_preview, last_sender from public.chat_conversations where id = $1",
        [conv],
      );
      expect(c).toEqual({ unread_for_admin: 2, unread_for_customer: 0, last_message_preview: "And in black?", last_sender: "customer" });

      await db.as("authenticated", admin);
      const { o } = await db.one<{ o: { chats_waiting: number } }>("select public.admin_overview() as o");
      expect(o.chats_waiting).toBeGreaterThanOrEqual(1);
      await db.query("select public.chat_admin_reply($1, 'Yes, both colours are in stock.')", [conv]);
      await db.asOwner();
      c = await db.one("select unread_for_admin, unread_for_customer, last_message_preview, last_sender from public.chat_conversations where id = $1", [conv]);
      expect(c).toMatchObject({ unread_for_admin: 0, unread_for_customer: 1, last_sender: "admin" });

      // The customer reads: their counter resets, messages come in order.
      await db.as("service_role");
      const { r } = await db.one<{ r: { messages: Array<{ sender: string; body: string }> } }>("select public.chat_customer_read($1, 0) as r", [conv]);
      expect(r.messages.map((m) => [m.sender, m.body])).toEqual([
        ["customer", "Is size M available?"],
        ["customer", "And in black?"],
        ["admin", "Yes, both colours are in stock."],
      ]);

      // Closed: the customer can't post; an admin reply reopens it.
      await db.as("authenticated", admin);
      await db.query("select public.chat_admin_set_status($1, 'closed')", [conv]);
      await db.as("service_role");
      expect((await db.fails("select public.chat_customer_post($1, null, 'hello?')", [conv])).message).toBe("conversation_closed");
      await db.as("authenticated", admin);
      await db.query("select public.chat_admin_reply($1, 'Reopening — how can we help?')", [conv]);
      await db.asOwner();
      expect((await db.one<{ status: string }>("select status from public.chat_conversations where id = $1", [conv])).status).toBe("open");
    });
  });

  it("validates input and keeps one open conversation per signed-in customer", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const first = await start(db, { userId: alice });
      const second = await start(db, { userId: alice, body: "Another question" });
      expect(second).toBe(first);
      await db.as("service_role");
      expect((await db.fails("select public.chat_customer_post($1, null, $2)", [first, "x".repeat(1001)])).message).toBe("invalid_message");
      expect((await db.fails("select public.chat_customer_post($1, null, '   ')", [first])).message).toBe("invalid_message");
      expect((await db.fails("select public.chat_start(null, $1, 'Ali', '12345', null, 'hi')", [hash("g3")])).message).toBe("invalid_phone");
      expect((await db.fails("select public.chat_start(null, $1, 'Ali', null, 'ABC', 'hi')", [hash("g3")])).message).toBe("invalid_order_number");
      expect((await db.fails("select public.chat_start(null, 'not-a-hash', 'Ali', null, null, 'hi')")).message).toBe("invalid_owner");
      // Control characters are stripped.
      await db.query("select public.chat_customer_post($1, null, $2)", [first, "ok\u0007 then"]);
      await db.asOwner();
      const [last] = await db.rows<{ body: string }>("select body from public.chat_messages where conversation_id = $1 order by id desc limit 1", [first]);
      expect(last.body).toBe("ok then");
    });
  });
});
