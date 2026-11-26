import { describe, expect, it } from "vitest";
import {
  AUDIENCES,
  DISCOUNT_TYPES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  STOCK_REASONS,
  USER_ROLES,
} from "@/lib/domain";
import { PAYMENT_METHODS } from "@/config/store";
import { withTx } from "./helpers";

describe("schema guarantees", () => {
  it("enables and forces RLS on every public table", async () => {
    await withTx(async (db) => {
      const rows = await db.rows<{ relname: string; rls: boolean; forced: boolean }>(
        `select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'`,
      );
      expect(rows.length).toBeGreaterThanOrEqual(15);
      for (const row of rows) {
        expect({ table: row.relname, rls: row.rls, forced: row.forced }).toEqual({
          table: row.relname,
          rls: true,
          forced: true,
        });
      }
    });
  });

  it("pins search_path on every SECURITY DEFINER function", async () => {
    await withTx(async (db) => {
      const rows = await db.rows<{ proname: string }>(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.prosecdef
            and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
      );
      expect(rows.map((r) => r.proname)).toEqual([]);
    });
  });

  it("keeps server-only functions away from browser roles", async () => {
    await withTx(async (db) => {
      const rows = await db.rows<{ fn: string; anon: boolean; auth: boolean; service: boolean }>(
        `select p.proname as fn,
                has_function_privilege('anon', p.oid, 'execute') as anon,
                has_function_privilege('authenticated', p.oid, 'execute') as auth,
                has_function_privilege('service_role', p.oid, 'execute') as service
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname in ('place_order', 'submit_payment_evidence', 'get_order_details',
                              'resolve_order_access', 'generate_order_number')`,
      );
      expect(rows).toHaveLength(5);
      for (const row of rows) {
        expect({ fn: row.fn, anon: row.anon, auth: row.auth }).toEqual({ fn: row.fn, anon: false, auth: false });
      }
      expect(rows.filter((r) => r.fn !== "generate_order_number").every((r) => r.service)).toBe(true);
    });
  });

  it("database enums match src/lib/domain.ts", async () => {
    await withTx(async (db) => {
      const enumValues = async (name: string) =>
        (
          await db.rows<{ v: string }>(
            `select e.enumlabel as v from pg_enum e join pg_type t on t.oid = e.enumtypid
              where t.typname = $1 order by e.enumsortorder`,
            [name],
          )
        ).map((r) => r.v);
      expect(await enumValues("order_status")).toEqual([...ORDER_STATUSES]);
      expect(await enumValues("payment_status")).toEqual([...PAYMENT_STATUSES]);
      expect(await enumValues("payment_method")).toEqual([...PAYMENT_METHODS]);
      expect(await enumValues("audience")).toEqual([...AUDIENCES]);
      expect(await enumValues("discount_type")).toEqual([...DISCOUNT_TYPES]);
      expect(await enumValues("stock_reason")).toEqual([...STOCK_REASONS]);
      expect(await enumValues("user_role")).toEqual([...USER_ROLES]);
    });
  });

  it("normalises Pakistani phone numbers", async () => {
    await withTx(async (db) => {
      const row = await db.one<Record<string, string | null>>(
        `select public.normalize_pk_phone('0300-1234567') a,
                public.normalize_pk_phone('+92 300 1234567') b,
                public.normalize_pk_phone('923001234567') c,
                public.normalize_pk_phone('3001234567') d,
                public.normalize_pk_phone('0212345678') e,
                public.normalize_pk_phone(null) f`,
      );
      expect(row).toEqual({
        a: "03001234567",
        b: "03001234567",
        c: "03001234567",
        d: "03001234567",
        e: null,
        f: null,
      });
    });
  });
});
