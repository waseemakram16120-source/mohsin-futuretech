import { describe, expect, it } from "vitest";
import { parsePaymentsConfig } from "@/lib/payments/config";
import { hmacSha256Hex, safeEqual, secureReference } from "@/lib/payments/crypto";
import { redact } from "@/lib/payments/log";
import { minorToDecimal, toMinor } from "@/lib/payments/money";
import { blockedProvider } from "@/lib/payments/providers/blocked";
import { canonical, signTestOutcome, verifyTestCallback } from "@/lib/payments/providers/test-gateway";
import { ATTEMPT_STATUSES, ATTEMPT_TRANSITIONS, canTransition } from "@/lib/payments/status";

const KEY = "unit-test-key";
const REF = "ABCDEFGHJK23456789XY";

describe("money in paisa", () => {
  it("converts database decimals exactly, never via floats", () => {
    expect(toMinor("5998.00")).toBe(599800);
    expect(toMinor("0.1")).toBe(10);
    expect(toMinor("1299")).toBe(129900);
    expect(toMinor(19.99)).toBe(1999);
    expect(minorToDecimal(599801)).toBe("5998.01");
    for (const bad of ["-1", "1.234", "abc", "", "1e5"]) expect(() => toMinor(bad)).toThrow();
  });
});

describe("crypto helpers", () => {
  it("references are opaque, unambiguous and unique", () => {
    const refs = new Set(Array.from({ length: 2000 }, () => secureReference(20)));
    expect(refs.size).toBe(2000);
    for (const r of refs) expect(r).toMatch(/^[A-HJ-NP-Z2-9]{20}$/);
  });
  it("constant-time compare", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("status machine", () => {
  it("paid is terminal and nothing moves back to created", () => {
    expect(ATTEMPT_TRANSITIONS.paid).toEqual([]);
    for (const s of ATTEMPT_STATUSES) expect(canTransition(s, "created")).toBe(false);
    expect(canTransition("failed", "paid")).toBe(true); // verified late success is recorded
    expect(canTransition("paid", "failed")).toBe(false);
  });
});

describe("payments config safety", () => {
  it("defaults to sandbox with no providers and no test gateway", () => {
    const c = parsePaymentsConfig({});
    expect(c).toMatchObject({ env: "sandbox", liveEnabled: false, testGateway: { enabled: false } });
    expect(c.jazzcash.missing.length).toBeGreaterThan(0);
  });

  it("production needs the explicit live switch and https", () => {
    expect(parsePaymentsConfig({ PAYMENTS_ENV: "production", PAYMENTS_PUBLIC_BASE_URL: "https://shop.pk" }).liveEnabled).toBe(false);
    const http = parsePaymentsConfig({ PAYMENTS_ENV: "production", PAYMENTS_LIVE_ENABLED: "true", PAYMENTS_PUBLIC_BASE_URL: "http://shop.pk" });
    expect(http.liveEnabled).toBe(false);
    expect(http.errors.join(" ")).toMatch(/https/);
    expect(
      parsePaymentsConfig({ PAYMENTS_ENV: "production", PAYMENTS_LIVE_ENABLED: "true", PAYMENTS_PUBLIC_BASE_URL: "https://shop.pk" }).liveEnabled,
    ).toBe(true);
  });

  it("the test gateway can never run in production", () => {
    expect(parsePaymentsConfig({ PAYMENTS_TEST_GATEWAY: "1" }).testGateway.enabled).toBe(true);
    expect(parsePaymentsConfig({ PAYMENTS_TEST_GATEWAY: "1", PAYMENTS_ENV: "production" }).testGateway.enabled).toBe(false);
    expect(parsePaymentsConfig({ PAYMENTS_TEST_GATEWAY: "1", VERCEL_ENV: "production" }).testGateway.enabled).toBe(false);
    expect(parsePaymentsConfig({ PAYMENTS_TEST_GATEWAY: "1", VERCEL_ENV: "production" }).errors.length).toBeGreaterThan(0);
  });

  it("unknown PAYMENTS_ENV values fall back to sandbox", () => {
    expect(parsePaymentsConfig({ PAYMENTS_ENV: "live!!" }).env).toBe("sandbox");
  });
});

describe("JazzCash / Easypaisa adapters (blocked until official docs)", () => {
  for (const [id, label] of [["jazzcash", "JazzCash"], ["easypaisa", "Easypaisa"]] as const) {
    it(`${label}: disabled, refuses to initiate, rejects every callback`, async () => {
      const p = blockedProvider(id, label, { values: {}, missing: ["X"] });
      expect(p.availability()).toMatchObject({ enabled: false });
      expect(p.availability().reason).toMatch(/official .* merchant integration guide/);
      await expect(p.initiate({ reference: REF, amountMinor: 100, currency: "PKR", orderNumber: "MF-261126-00001", expiresAt: "", customer: { phone: "", email: null } })).rejects.toThrow();
      const v = await p.verifyCallback({ method: "POST", params: { pp_ResponseCode: "000", status: "SUCCESS", amount: "1" } });
      expect(v).toMatchObject({ verified: false, reason: "provider_not_implemented" });
    });
  }
});

describe("sandbox test gateway protocol", () => {
  const now = 1_800_000_000_000;
  const signed = (over: Partial<Parameters<typeof signTestOutcome>[1]> = {}) =>
    signTestOutcome(KEY, { reference: REF, result: "paid", amountMinor: 599800, currency: "PKR", now, ...over });

  it("verifies a genuine success", () => {
    const v = verifyTestCallback(KEY, signed(), now + 1000);
    expect(v).toMatchObject({ verified: true, reference: REF, result: "paid", amountMinor: 599800, currency: "PKR" });
    if (v.verified) expect(v.providerTxnId).toMatch(/^TEST-/);
  });

  it("rejects tampering with any signed field", () => {
    for (const field of ["amount_minor", "currency", "result", "reference", "txn", "ts", "nonce"] as const) {
      const f = signed();
      const tampered = { ...f, [field]: field === "amount_minor" ? "1" : field === "result" ? "failed" : field === "ts" ? String(now + 1) : `${f[field]}X` };
      const v = verifyTestCallback(KEY, tampered, now + 1000);
      expect({ field, verified: v.verified }).toEqual({ field, verified: false });
    }
  });

  it("rejects wrong key, missing fields, malformed signature, stale and future messages", () => {
    expect(verifyTestCallback("other-key", signed(), now)).toMatchObject({ verified: false, reason: "invalid_signature" });
    const { signature, ...rest } = signed();
    void signature;
    expect(verifyTestCallback(KEY, rest, now)).toMatchObject({ verified: false, reason: "missing_signature" });
    const missing = { ...signed() } as Record<string, string>;
    delete missing.currency;
    expect(verifyTestCallback(KEY, missing, now)).toMatchObject({ verified: false, reason: "missing_fields" });
    expect(verifyTestCallback(KEY, signed(), now + 16 * 60 * 1000)).toMatchObject({ verified: false, reason: "stale_or_future_timestamp" });
    expect(verifyTestCallback(KEY, signed({ now: now + 5 * 60 * 1000 }), now)).toMatchObject({ verified: false, reason: "stale_or_future_timestamp" });
  });

  it("rejects a correctly signed but unrecognised status", () => {
    const f = { reference: REF, result: "SUCCESSFUL", txn: "X", amount_minor: "1", currency: "PKR", ts: String(now), nonce: "N" };
    const v = verifyTestCallback(KEY, { ...f, signature: hmacSha256Hex(KEY, canonical(f)) }, now);
    expect(v).toMatchObject({ verified: false, reason: "unrecognised_status" });
  });

  it("the same message always has the same dedupe key; different messages differ", () => {
    const a = signed();
    const v1 = verifyTestCallback(KEY, a, now);
    const v2 = verifyTestCallback(KEY, { ...a }, now);
    const v3 = verifyTestCallback(KEY, signed(), now);
    expect(v1.dedupeKey).toBe(v2.dedupeKey);
    expect(v1.dedupeKey).not.toBe(v3.dedupeKey);
  });
});

describe("log redaction", () => {
  it("keeps only whitelisted, non-secret fields", () => {
    const out = redact({
      event: "callback",
      reference: REF,
      signature: "deadbeef",
      password: "x",
      JAZZCASH_INTEGRITY_SALT: "x",
      params: { pin: "1234" },
      amountMinor: 100,
    });
    expect(out).toEqual({ event: "callback", reference: REF, amountMinor: 100 });
  });
});
