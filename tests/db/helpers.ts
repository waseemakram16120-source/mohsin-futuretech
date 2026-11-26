/**
 * Database test helpers.
 *
 * Every test runs inside a transaction that is rolled back at the end, so
 * tests never leak data. Inside a test we switch between Postgres roles the
 * same way PostgREST does on hosted Supabase:
 *   anon           — signed-out shopper
 *   authenticated  — signed-in user (JWT `sub` = user id)
 *   service_role   — the Next.js server using the service-role key
 *   postgres       — fixture setup (bypasses RLS)
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, expect } from "vitest";

const connectionString =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:54322/postgres";

export const pool = new pg.Pool({ connectionString, max: 6 });

afterAll(async () => {
  await pool.end();
});

type Role = "anon" | "authenticated" | "service_role";

export class Db {
  constructor(readonly client: pg.PoolClient) {}

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []) {
    return this.client.query<T>(sql, params);
  }

  async rows<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []) {
    return (await this.query<T>(sql, params)).rows;
  }

  async one<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []) {
    const rows = await this.rows<T>(sql, params);
    expect(rows).toHaveLength(1);
    return rows[0];
  }

  /** Act as a Supabase client role (with optional signed-in user id). */
  async as(role: Role, userId?: string) {
    const claims = JSON.stringify({ role, ...(userId ? { sub: userId } : {}) });
    await this.query("reset role");
    await this.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await this.query("select set_config('request.jwt.claim.role', $1, true)", [role]);
    await this.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    await this.query(`set local role ${role}`);
    return this;
  }

  /** Back to the superuser-like owner for fixture setup/inspection. */
  async asOwner() {
    await this.query("reset role");
    await this.query("select set_config('request.jwt.claims', '', true)");
    await this.query("select set_config('request.jwt.claim.role', '', true)");
    await this.query("select set_config('request.jwt.claim.sub', '', true)");
    return this;
  }

  /**
   * Run a statement that must fail; returns the error. Uses a savepoint so
   * the surrounding transaction stays usable.
   */
  async fails(sql: string, params: unknown[] = []): Promise<pg.DatabaseError> {
    await this.query("savepoint expect_fail");
    try {
      await this.query(sql, params);
    } catch (error) {
      await this.query("rollback to savepoint expect_fail");
      return error as pg.DatabaseError;
    }
    await this.query("release savepoint expect_fail");
    throw new Error(`Expected statement to fail: ${sql}`);
  }

  /** Create an auth user (profile is created by the trigger). */
  async createUser(opts: { admin?: boolean; name?: string } = {}) {
    const id = randomUUID();
    await this.asOwner();
    await this.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
      [id, `user-${id.slice(0, 8)}@test.local`, { full_name: opts.name ?? "Test User" }],
    );
    if (opts.admin) {
      await this.query("update public.profiles set role = 'admin' where id = $1", [id]);
    }
    return id;
  }

  /** First active variant with at least `minStock` units (owner view). */
  async variantWithStock(minStock = 5) {
    await this.asOwner();
    return this.one<{ id: string; stock_quantity: number; price: string; product_id: string }>(
      `select v.id, v.stock_quantity, coalesce(v.price_override, p.base_price)::text as price, p.id as product_id
         from public.product_variants v join public.products p on p.id = v.product_id
        where v.is_active and p.is_active and v.stock_quantity >= $1
        order by v.sku limit 1`,
      [minStock],
    );
  }

  /** Place an order as the server (service role). */
  async placeOrder(opts: {
    userId?: string | null;
    items: Array<{ variant_id: string; quantity: number }>;
    method?: "cod" | "easypaisa" | "jazzcash" | "nayapay";
    coupon?: string | null;
    phone?: string;
  }) {
    await this.as("service_role");
    const customer = {
      name: "Ali Khan",
      phone: opts.phone ?? "0300-1234567",
      email: "ali@example.com",
      address: "House 12, Street 4, Block B, Gulshan-e-Iqbal",
      city: "Karachi",
      province: "Sindh",
    };
    const row = await this.one<{ result: OrderResult }>(
      "select public.place_order($1, $2, $3, $4, $5) as result",
      [opts.userId ?? null, customer, JSON.stringify(opts.items), opts.method ?? "cod", opts.coupon ?? null],
    );
    return row.result;
  }
}

export interface OrderResult {
  order_id: string;
  order_number: string;
  subtotal: number;
  discount_amount: number;
  delivery_charge: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
}

/** Run `fn` inside a transaction that is always rolled back. */
export async function withTx(fn: (db: Db) => Promise<void>) {
  const client = await pool.connect();
  await client.query("begin");
  try {
    await fn(new Db(client));
  } finally {
    await client.query("rollback");
    client.release();
  }
}
