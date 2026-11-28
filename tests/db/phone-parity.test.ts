import { describe, expect, it } from "vitest";
import { normalizePkPhone } from "@/lib/checkout/phone";
import { withTx } from "./helpers";

const samples = [
  "03001234567", "0300-1234567", "0300 123 4567", "+92 300 1234567", "923001234567", "3001234567",
  "0212345678", "12345", "", "0300123456", "030012345678", "+923451234567", "92-345-1234567", "04001234567",
];

describe("normalizePkPhone matches the database", () => {
  it("for every sample", async () => {
    await withTx(async (db) => {
      for (const s of samples) {
        const { v } = await db.one<{ v: string | null }>("select public.normalize_pk_phone($1) as v", [s]);
        expect({ input: s, value: normalizePkPhone(s) }).toEqual({ input: s, value: v });
      }
    });
  });
});
