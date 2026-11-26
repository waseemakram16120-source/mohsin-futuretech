import { describe, expect, it } from "vitest";
import { withTx } from "./helpers";

describe("customer data access (RLS)", () => {
  it("a signup creates a customer profile that only its owner can read", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser({ name: "Alice" });
      const bob = await db.createUser({ name: "Bob" });

      await db.as("authenticated", alice);
      const profiles = await db.rows<{ id: string; role: string; full_name: string }>(
        "select id, role, full_name from public.profiles",
      );
      expect(profiles).toEqual([{ id: alice, role: "customer", full_name: "Alice" }]);

      const other = await db.rows("select id from public.profiles where id = $1", [bob]);
      expect(other).toHaveLength(0);

      await db.as("anon");
      expect((await db.fails("select id from public.profiles")).code).toBe("42501");
    });
  });

  it("customers can edit their name/phone but never their role or email", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      await db.as("authenticated", alice);

      const ok = await db.query(
        "update public.profiles set full_name = 'Alice K', phone = '03001112222' where id = $1",
        [alice],
      );
      expect(ok.rowCount).toBe(1);

      const role = await db.fails("update public.profiles set role = 'admin' where id = $1", [alice]);
      expect(role.code).toBe("42501");
      const email = await db.fails("update public.profiles set email = 'x@y.z' where id = $1", [alice]);
      expect(email.code).toBe("42501");

      const bad = await db.fails("update public.profiles set phone = '12345' where id = $1", [alice]);
      expect(bad.code).toBe("23514"); // check constraint
    });
  });

  it("admins can promote a user; the SQL editor can too", async () => {
    await withTx(async (db) => {
      const admin = await db.createUser({ admin: true });
      const staff = await db.createUser();
      await db.as("authenticated", admin);
      const res = await db.query("update public.profiles set role = 'admin' where id = $1", [staff]);
      expect(res.rowCount).toBe(1);
    });
  });

  it("addresses and wishlist are private to their owner", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const bob = await db.createUser();

      await db.as("authenticated", alice);
      await db.query(
        `insert into public.addresses (user_id, full_name, phone, address_line1, city, is_default)
         values ($1, 'Alice Khan', '03001234567', 'House 1, Street 2', 'Lahore', true)`,
        [alice],
      );
      const product = await db.one<{ id: string }>(
        "select id from public.products where slug = 'leather-belt'",
      );
      await db.query("insert into public.wishlist (user_id, product_id) values ($1, $2)", [
        alice,
        product.id,
      ]);

      // Alice cannot write rows for Bob.
      const forged = await db.fails(
        `insert into public.addresses (user_id, full_name, phone, address_line1, city)
         values ($1, 'Bob', '03001234567', 'House 1, Street 2', 'Lahore')`,
        [bob],
      );
      expect(forged.code).toBe("42501");

      await db.as("authenticated", bob);
      expect(await db.rows("select id from public.addresses")).toHaveLength(0);
      expect(await db.rows("select id from public.wishlist")).toHaveLength(0);
      const del = await db.query("delete from public.addresses");
      expect(del.rowCount).toBe(0);

      await db.as("authenticated", alice);
      expect(await db.rows("select id from public.addresses")).toHaveLength(1);
      expect(await db.rows("select id from public.wishlist")).toHaveLength(1);
    });
  });

  it("only one default address per customer", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      await db.as("authenticated", alice);
      const insert = `insert into public.addresses (user_id, full_name, phone, address_line1, city, is_default)
                      values ($1, 'Alice Khan', '03001234567', 'House 1, Street 2', 'Lahore', true)`;
      await db.query(insert, [alice]);
      expect((await db.fails(insert, [alice])).code).toBe("23505");
    });
  });

  it("customers cannot create or modify orders and payments directly", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const variant = await db.variantWithStock(3);
      const order = await db.placeOrder({
        userId: alice,
        items: [{ variant_id: variant.id, quantity: 1 }],
        method: "easypaisa",
      });

      await db.as("authenticated", alice);
      const insertOrder = await db.fails(
        `insert into public.orders (order_number, delivery_name, delivery_phone, delivery_address,
           city, subtotal, delivery_charge, total_amount, payment_method, payment_status, user_id)
         values ('MF-HACK', 'Alice', '03001234567', 'Somewhere long enough', 'Karachi', 1, 0, 1, 'cod', 'paid', $1)`,
        [alice],
      );
      expect(insertOrder.code).toBe("42501");

      const fakePayment = await db.fails(
        `insert into public.payments (order_id, method, amount, status)
         values ($1, 'easypaisa', 1, 'approved')`,
        [order.order_id],
      );
      expect(fakePayment.code).toBe("42501");

      expect(
        (await db.fails("update public.orders set status = 'delivered' where id = $1", [order.order_id])).code,
      ).toBe("42501");
      expect(
        (await db.fails("update public.payments set status = 'approved' where order_id = $1", [order.order_id]))
          .code,
      ).toBe("42501");

      expect(
        (await db.fails("select public.review_payment(gen_random_uuid(), 'approve', null)")).message,
      ).toBe("forbidden");
      expect(
        (await db.fails("select public.place_order($1, '{}'::jsonb, '[]'::jsonb, 'cod', null)", [alice])).code,
      ).toBe("42501");
    });
  });

  it("customers see only their own orders, items, history and payments", async () => {
    await withTx(async (db) => {
      const alice = await db.createUser();
      const bob = await db.createUser();
      const variant = await db.variantWithStock(3);
      await db.placeOrder({ userId: alice, items: [{ variant_id: variant.id, quantity: 1 }] });
      await db.placeOrder({ userId: null, items: [{ variant_id: variant.id, quantity: 1 }] }); // guest

      await db.as("authenticated", alice);
      expect(await db.rows("select id from public.orders")).toHaveLength(1);
      expect(await db.rows("select id from public.order_items")).toHaveLength(1);
      expect(await db.rows("select id from public.order_status_history")).toHaveLength(1);
      expect(await db.rows("select id from public.payments")).toHaveLength(1);

      await db.as("authenticated", bob);
      expect(await db.rows("select id from public.orders")).toHaveLength(0);
      expect(await db.rows("select id from public.payments")).toHaveLength(0);

      await db.as("anon");
      expect((await db.fails("select id from public.orders")).code).toBe("42501");
    });
  });
});
