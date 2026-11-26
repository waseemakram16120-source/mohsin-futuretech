import { describe, expect, it } from "vitest";
import { couponMessage, orderErrorMessage } from "@/lib/checkout/errors";
import { rememberOrder, signOrders, verifyOrders } from "@/lib/checkout/order-access";
import { formatPkPhone, normalizePkPhone } from "@/lib/checkout/phone";
import { createRateLimiter } from "@/lib/checkout/rate-limit";
import { fieldErrors, placeOrderSchema } from "@/lib/checkout/schema";
import { computeTotals } from "@/lib/checkout/totals";
import { setLineQuantity } from "@/lib/stores/cart";

const variant = "00000000-0000-4000-8000-000000000001";
const valid = {
  customer: {
    name: "  Ali   Khan ",
    phone: "+92 300 123-4567",
    email: "Ali@Example.com",
    address: "House 12, Street 4, Block B, Gulshan-e-Iqbal",
    city: "Karachi",
    province: "Sindh",
    postalCode: "75300",
    notes: "",
  },
  items: [{ variantId: variant, quantity: 2 }],
  paymentMethod: "nayapay",
  couponCode: " welcome10 ",
};

describe("phone", () => {
  it("normalises every common spelling", () => {
    for (const input of ["03001234567", "0300-1234567", "+92 300 1234567", "923001234567", "3001234567"]) {
      expect(normalizePkPhone(input)).toBe("03001234567");
    }
  });
  it("rejects landlines and junk", () => {
    for (const input of ["0212345678", "12345", "", null, "0300123456", "04001234567"]) {
      expect(normalizePkPhone(input)).toBeNull();
    }
  });
  it("formats for display", () => {
    expect(formatPkPhone("923001234567")).toBe("0300 1234567");
  });
});

describe("placeOrderSchema", () => {
  it("cleans and accepts a valid order (all four payment methods)", () => {
    const r = placeOrderSchema.parse(valid);
    expect(r.customer).toMatchObject({ name: "Ali Khan", phone: "03001234567", email: "ali@example.com", postalCode: "75300" });
    expect(r.couponCode).toBe("WELCOME10");
    for (const m of ["cod", "easypaisa", "jazzcash", "nayapay"]) {
      expect(placeOrderSchema.safeParse({ ...valid, paymentMethod: m }).success).toBe(true);
    }
  });

  it("explains each invalid field", () => {
    const r = placeOrderSchema.safeParse({
      ...valid,
      customer: { ...valid.customer, name: "A", phone: "12345", email: "nope", address: "short", city: "", postalCode: "12" },
      paymentMethod: "card",
    });
    expect(r.success).toBe(false);
    const errors = fieldErrors(r.error!);
    expect(errors).toMatchObject({
      name: "Please enter your full name.",
      phone: "Enter a valid Pakistani mobile number, e.g. 0300 1234567.",
      email: "Please enter a valid email address or leave it empty.",
      address: "Please enter your full delivery address.",
      city: "Please enter your full city.",
      postalCode: "Postal code must be 5 digits.",
      paymentMethod: "Please choose a payment method.",
    });
  });

  it("allows optional fields to be empty and rejects bad items", () => {
    const minimal = { ...valid, customer: { ...valid.customer, email: "", postalCode: "", province: "" }, couponCode: "" };
    expect(placeOrderSchema.safeParse(minimal).success).toBe(true);
    expect(placeOrderSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...valid, items: [{ variantId: "x", quantity: 1 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...valid, items: [{ variantId: variant, quantity: 11 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...valid, couponCode: "DROP TABLE;" }).success).toBe(false);
  });

  it("names must contain letters", () => {
    expect(placeOrderSchema.safeParse({ ...valid, customer: { ...valid.customer, name: "12345" } }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...valid, customer: { ...valid.customer, name: "محسن علی" } }).success).toBe(true);
  });
});

describe("computeTotals (mirrors place_order)", () => {
  const settings = { deliveryCharge: 250, freeDeliveryMin: 5000 };
  it("charges delivery below the minimum and shows how much is left", () => {
    expect(computeTotals([{ unitPrice: 1299, quantity: 1 }], settings)).toEqual({
      subtotal: 1299, discount: 0, delivery: 250, total: 1549, toFreeDelivery: 3701, itemCount: 1,
    });
  });
  it("delivery is free at the minimum, measured after the discount", () => {
    expect(computeTotals([{ unitPrice: 2500, quantity: 2 }], settings).delivery).toBe(0);
    const t = computeTotals([{ unitPrice: 4499, quantity: 1 }], settings, 450);
    expect(t).toMatchObject({ subtotal: 4499, discount: 450, delivery: 250, total: 4299 });
  });
  it("never discounts below zero and an empty bag costs nothing", () => {
    expect(computeTotals([{ unitPrice: 100, quantity: 1 }], settings, 500).discount).toBe(100);
    expect(computeTotals([], settings).total).toBe(0);
  });
});

describe("error messages", () => {
  it("maps database codes to friendly text", () => {
    expect(couponMessage("coupon_min_order", 2000)).toBe("This coupon needs an order of Rs 2,000 or more.");
    expect(orderErrorMessage("coupon_expired")).toBe("This coupon has expired.");
    expect(orderErrorMessage("out_of_stock")).toMatch(/enough stock/);
    expect(orderErrorMessage("some internal error")).toMatch(/couldn't place your order/);
  });
});

describe("order access cookie", () => {
  const key = "test-key";
  it("round-trips and rejects tampering or another key", () => {
    const value = signOrders(key, ["MF-261126-00001", "MF-261126-00002"]);
    expect(verifyOrders(key, value)).toEqual(["MF-261126-00001", "MF-261126-00002"]);
    expect(verifyOrders("other-key", value)).toEqual([]);
    const [payload, sig] = value.split(".");
    const forged = Buffer.from(JSON.stringify(["MF-261126-99999"])).toString("base64url");
    expect(verifyOrders(key, `${forged}.${sig}`)).toEqual([]);
    expect(verifyOrders(key, `${payload}.x`)).toEqual([]);
    expect(verifyOrders(key, "garbage")).toEqual([]);
    expect(verifyOrders(key, undefined)).toEqual([]);
  });
  it("keeps the newest 10 valid order numbers", () => {
    let list: string[] = [];
    for (let i = 1; i <= 12; i++) list = rememberOrder(list, `MF-261126-${String(i).padStart(5, "0")}`);
    expect(list).toHaveLength(10);
    expect(list[0]).toBe("MF-261126-00012");
    expect(verifyOrders(key, signOrders(key, ["not-an-order", "MF-261126-00001"]))).toEqual(["MF-261126-00001"]);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit per window, then reports when to retry", () => {
    const rl = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(rl.check("ip", 0).ok).toBe(true);
    expect(rl.check("ip", 100).ok).toBe(true);
    expect(rl.check("ip", 200)).toEqual({ ok: false, retryAfterSeconds: 1 });
    expect(rl.check("other", 200).ok).toBe(true);
    expect(rl.check("ip", 1100).ok).toBe(true);
  });
});

describe("cart quantities", () => {
  it("sets, caps and removes", () => {
    const lines = [{ variantId: variant, quantity: 2 }];
    expect(setLineQuantity(lines, variant, 4)).toEqual([{ variantId: variant, quantity: 4 }]);
    expect(setLineQuantity(lines, variant, 50)[0].quantity).toBe(10);
    expect(setLineQuantity(lines, variant, 0)).toEqual([]);
  });
});
