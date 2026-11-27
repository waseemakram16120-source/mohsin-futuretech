import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/redirect";
import { addressSchema, issuesByField, loginSchema, profileSchema, resetPasswordSchema, signupSchema, trackSchema } from "@/lib/auth/schemas";

describe("safeNext (no open redirects)", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/checkout")).toBe("/checkout");
    expect(safeNext("/orders/MF-261127-00001?x=1#top")).toBe("/orders/MF-261127-00001?x=1#top");
    expect(safeNext("/account/addresses")).toBe("/account/addresses");
  });

  it("rejects other sites and tricks", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      " //evil.example",
      "/%5Cevil.example".replace("%5C", "\\"),
      "/\tevil",
      "evil.example",
      "",
      null,
      undefined,
      42,
      "/" + "a".repeat(400),
    ]) {
      expect(safeNext(bad)).toBe("/account");
    }
  });

  it("never loops back into auth pages or APIs", () => {
    expect(safeNext("/login")).toBe("/account");
    expect(safeNext("/signup?next=/x")).toBe("/account");
    expect(safeNext("/auth/confirm")).toBe("/account");
    expect(safeNext("/api/orders")).toBe("/account");
    expect(safeNext("/x", "/reset-password")).toBe("/x");
    expect(safeNext("//x", "/reset-password")).toBe("/reset-password");
  });
});

describe("account form validation", () => {
  it("login and sign-up", () => {
    expect(loginSchema.safeParse({ email: " Ali@Example.COM ", password: "x" }).data?.email).toBe("ali@example.com");
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);

    const ok = { name: "Ali Khan", email: "ali@example.com", password: "secret123", confirmPassword: "secret123" };
    expect(signupSchema.safeParse(ok).success).toBe(true);
    const errs = (v: object) => {
      const r = signupSchema.safeParse({ ...ok, ...v });
      return r.success ? {} : issuesByField(r.error);
    };
    expect(errs({ password: "short1", confirmPassword: "short1" }).password).toMatch(/at least 8/);
    expect(errs({ password: "onlyletters", confirmPassword: "onlyletters" }).password).toMatch(/letter and one number/);
    expect(errs({ confirmPassword: "secret124" }).confirmPassword).toBe("Passwords do not match.");
    expect(errs({ name: "Al" }).name).toBeDefined();
    expect(errs({ name: "12345" }).name).toBeDefined();
    expect(resetPasswordSchema.safeParse({ password: "newpass99", confirmPassword: "newpass99" }).success).toBe(true);
  });

  it("profile phone is optional but must be Pakistani when given", () => {
    expect(profileSchema.safeParse({ name: "Ali Khan", phone: "" }).data?.phone).toBeNull();
    expect(profileSchema.safeParse({ name: "Ali Khan", phone: "+92 300 1234567" }).data?.phone).toBe("03001234567");
    expect(profileSchema.safeParse({ name: "Ali Khan", phone: "12345" }).success).toBe(false);
  });

  it("addresses", () => {
    const base = { label: "Home", name: "Ali Khan", phone: "0300-1234567", line1: "House 12, Street 4, DHA", city: "Karachi" };
    const r = addressSchema.safeParse(base);
    expect(r.data).toMatchObject({ phone: "03001234567", line2: "", province: "", postalCode: "", isDefault: false });
    expect(addressSchema.safeParse({ ...base, phone: "" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...base, line1: "short" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...base, postalCode: "7500" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...base, province: "Texas" }).success).toBe(false);
  });

  it("order tracking input", () => {
    expect(trackSchema.safeParse({ orderNumber: " mf-261127-00031 ", phone: "0300 1234567" }).data).toEqual({
      orderNumber: "MF-261127-00031",
      phone: "03001234567",
    });
    expect(trackSchema.safeParse({ orderNumber: "12345", phone: "0300 1234567" }).success).toBe(false);
    expect(trackSchema.safeParse({ orderNumber: "MF-261127-00031", phone: "" }).success).toBe(false);
  });
});
