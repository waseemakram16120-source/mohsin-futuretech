import { expect, test, type Page } from "@playwright/test";
import { sql } from "./db";

// Checkout tests change stock and coupon counts, so run them one at a time.
test.describe.configure({ mode: "serial" });

const OXFORD = "/products/mens-oxford-button-down-shirt"; // Rs 2,999
const CAP = "/products/canvas-baseball-cap"; // Rs 1,299, one size

async function addToBag(page: Page, path: string, opts: { size?: string; qty?: number } = {}) {
  await page.goto(path);
  if (opts.size) {
    await page.locator("label", { has: page.getByRole("radio", { name: opts.size, exact: true }) }).click();
  } else {
    // First in-stock size (one-size products are pre-selected).
    const first = page.locator('input[type=radio][name^="size-"]:not([disabled])').first();
    if (!(await first.isChecked())) {
      const size = (await first.getAttribute("value"))!;
      await page.locator("label", { has: page.getByRole("radio", { name: size, exact: true }) }).click();
    }
  }
  for (let i = 1; i < (opts.qty ?? 1); i++) await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Add to bag" }).first().click();
  await expect(page.getByText(/Added to your bag/)).toBeVisible();
}

async function fillCheckout(page: Page, overrides: Partial<Record<string, string>> = {}) {
  const v = {
    "Full name": "Ayesha Siddiqui",
    "Mobile number": "0321 7654321",
    "Delivery address": "Flat 4, Plot 22, Block 5, Clifton",
    City: "Karachi",
    ...overrides,
  };
  for (const [label, value] of Object.entries(v)) await page.getByLabel(label, { exact: true }).fill(value ?? "");
}

const placeOrder = (page: Page) => page.getByRole("button", { name: /Place order/ }).filter({ visible: true }).click();

test.describe("bag", () => {
  test("empty bag shows a helpful empty state", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
  });

  test("live prices, quantities, free delivery progress and coupons", async ({ page }) => {
    await addToBag(page, CAP);
    await page.goto("/cart");
    const line = page.getByTestId("cart-line");
    await expect(line).toHaveCount(1);
    await expect(line).toContainText("Canvas Baseball Cap");
    await expect(page.getByTestId("subtotal")).toHaveText("Rs 1,299");
    await expect(page.getByTestId("delivery")).toHaveText("Rs 250");
    await expect(page.getByTestId("total")).toHaveText("Rs 1,549");
    await expect(page.getByTestId("free-delivery")).toContainText("Add Rs 3,701 more");

    // Coupon below its minimum (Rs 2,000) is explained.
    await page.getByLabel("Coupon code").fill("welcome10");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Rs 2,000 or more" })).toBeVisible();

    // Two caps → Rs 2,598: the coupon now applies.
    await line.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByTestId("subtotal")).toHaveText("Rs 2,598");
    await expect(page.getByText("WELCOME10 applied.")).toBeVisible();
    await expect(page.getByTestId("discount")).toHaveText("−Rs 260");
    await expect(page.getByTestId("total")).toHaveText("Rs 2,588"); // 2,598 − 260 + 250

    await page.getByRole("button", { name: "Remove", exact: true }).click(); // remove coupon
    await expect(page.getByTestId("discount")).toHaveCount(0);

    await line.getByRole("button", { name: /Remove Canvas Baseball Cap/ }).click();
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
  });

  test("stock changes are caught in the bag and can be fixed in one click", async ({ page }) => {
    await addToBag(page, OXFORD, { qty: 3 });
    // Another shopper buys most of the stock of the variant in this bag.
    const bag = await page.evaluate(() => JSON.parse(localStorage.getItem("mft.cart.v1") ?? "[]"));
    const [{ stock_quantity: original }] = await sql<{ stock_quantity: number }>(
      "select stock_quantity from product_variants where id = $1",
      [bag[0].variantId],
    );
    await sql("update product_variants set stock_quantity = 1 where id = $1", [bag[0].variantId]);

    await page.goto("/cart");
    await expect(page.getByText("Some items changed since you added them.")).toBeVisible();
    await expect(page.getByTestId("cart-line")).toContainText("Only 1 left");
    await expect(page.getByRole("button", { name: "Update your bag to continue" })).toBeDisabled();
    await page.getByRole("button", { name: "Update my bag" }).click();
    await expect(page.getByText("Some items changed since you added them.")).toHaveCount(0);
    await expect(page.getByTestId("cart-line").getByLabel("Quantity", { exact: true })).toHaveText("1");
    await sql("update product_variants set stock_quantity = $2 where id = $1", [bag[0].variantId, original]);
  });
});

test.describe("checkout", () => {
  test("validates every field inline and in an error summary", async ({ page }) => {
    const [{ n: ordersBefore }] = await sql<{ n: string }>("select count(*)::text as n from orders");
    await addToBag(page, CAP);
    await page.goto("/checkout");
    // The floating WhatsApp button is hidden so it never covers form fields.
    await expect(page.getByRole("link", { name: /Chat with us on WhatsApp/ })).toHaveCount(0);
    await fillCheckout(page, { "Full name": "A", "Mobile number": "12345", "Delivery address": "short", City: "" });
    await placeOrder(page);
    const summary = page.getByRole("alert").filter({ hasText: "Please fix" });
    await expect(summary).toContainText("Full name: Please enter your full name.");
    await expect(summary).toContainText("Mobile number: Enter a valid Pakistani mobile number");
    await expect(summary).toContainText("Delivery address: Please enter your full delivery address.");
    await expect(summary).toContainText("Payment method: Please choose a payment method.");
    await expect(page.getByLabel("Full name", { exact: true })).toBeFocused();
    await expect(page.getByLabel("Mobile number", { exact: true })).toHaveAttribute("aria-invalid", "true");
    const [{ n: ordersAfter }] = await sql<{ n: string }>("select count(*)::text as n from orders");
    expect(ordersAfter).toBe(ordersBefore);
  });

  test("places a COD order: confirmation, cart cleared, stock and DB updated", async ({ page }) => {
    await addToBag(page, OXFORD, { qty: 2 });
    const bag = await page.evaluate(() => JSON.parse(localStorage.getItem("mft.cart.v1") ?? "[]"));
    const [{ stock_quantity: before }] = await sql<{ stock_quantity: number }>("select stock_quantity from product_variants where id = $1", [bag[0].variantId]);

    await page.goto("/checkout");
    await expect(page.getByTestId("total")).toHaveText("Rs 5,998"); // free delivery
    await fillCheckout(page);
    await page.getByLabel("Email").fill("ayesha@example.com");
    await page.getByRole("radio", { name: /Cash on Delivery/ }).check();
    await placeOrder(page);

    await expect(page).toHaveURL(/\/orders\/MF-\d{6}-\d{5,}\?placed=1$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you, Ayesha!");
    const number = (await page.getByTestId("order-number").textContent())!.trim();
    await expect(page.getByText("Payment: COD — Due")).toBeVisible();
    await expect(page.getByTestId("order-item")).toHaveCount(1);
    await expect(page.getByText("Pay Rs 5,998 in cash when it arrives.")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveCount(0);

    const [order] = await sql<{ total_amount: string; delivery_phone: string; customer_email: string; status: string; payment_status: string }>(
      "select total_amount, delivery_phone, customer_email, status, payment_status from orders where order_number = $1",
      [number],
    );
    expect(order).toEqual({ total_amount: "5998.00", delivery_phone: "03217654321", customer_email: "ayesha@example.com", status: "pending", payment_status: "due" });
    const [{ stock_quantity: after }] = await sql<{ stock_quantity: number }>("select stock_quantity from product_variants where id = $1", [bag[0].variantId]);
    expect(after).toBe(before - 2);

    // The confirmation survives a refresh, but another browser cannot see it.
    await page.reload();
    await expect(page.getByTestId("order-number")).toHaveText(number);
    const stranger = await page.context().browser()!.newPage();
    await stranger.goto(`/orders/${number}`);
    await expect(stranger.getByRole("heading", { name: "We can’t show this order here" })).toBeVisible();
    await expect(stranger.getByText("Ayesha")).toHaveCount(0);
    await stranger.close();
  });

  test("wallet order (NayaPay) with a coupon shows account details and Pending next step", async ({ page }) => {
    await addToBag(page, OXFORD);
    await page.goto("/cart");
    await page.getByLabel("Coupon code").fill("WELCOME10");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByTestId("discount")).toHaveText("−Rs 300");
    await page.getByRole("link", { name: "Checkout securely" }).click();

    await fillCheckout(page);
    await page.getByRole("radio", { name: /NayaPay/ }).check();
    await expect(page.getByText(/see our NayaPay account details/)).toBeVisible();
    await placeOrder(page);

    await expect(page.getByTestId("order-number")).toBeVisible();
    await expect(page.getByText("Payment: Awaiting Payment")).toBeVisible();
    await expect(page.getByTestId("wallet-account")).toContainText("NayaPay account name");
    await expect(page.getByRole("link", { name: "Submit payment proof" })).toHaveAttribute("href", /\/pay\/MF-/);
    const number = (await page.getByTestId("order-number").textContent())!.trim();
    const [o] = await sql<{ discount_amount: string; coupon_code: string; total_amount: string; payment_method: string }>(
      "select discount_amount, coupon_code, total_amount, payment_method from orders where order_number = $1",
      [number],
    );
    expect(o).toEqual({ discount_amount: "300.00", coupon_code: "WELCOME10", total_amount: "2949.00", payment_method: "nayapay" });
    const [{ used_count }] = await sql<{ used_count: number }>("select used_count from coupons where code = 'WELCOME10'");
    expect(used_count).toBeGreaterThanOrEqual(1);
  });

  test("selling out between the bag and payment is handled gracefully", async ({ page }) => {
    await addToBag(page, CAP);
    await page.goto("/checkout");
    await fillCheckout(page);
    await page.getByRole("radio", { name: /Cash on Delivery/ }).check();
    // Someone else buys the last one before this shopper clicks Place order.
    const bag = await page.evaluate(() => JSON.parse(localStorage.getItem("mft.cart.v1") ?? "[]"));
    await sql("update product_variants set stock_quantity = 0 where id = $1", [bag[0].variantId]);
    await placeOrder(page);
    await expect(page.getByText(/no longer have enough stock/)).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByText(/changed \(price or stock\)/)).toBeVisible();
    await sql("update product_variants set stock_quantity = 10 where id = $1", [bag[0].variantId]);
  });
});

test.describe("order API", () => {
  test("rejects invalid input, foreign origins and tampered prices are impossible", async ({ request }) => {
    const bad = await request.post("/api/orders", { data: { customer: {}, items: [], paymentMethod: "card" } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).fieldErrors).toHaveProperty("paymentMethod");

    const cross = await request.post("/api/orders", { data: {}, headers: { Origin: "https://evil.example" } });
    expect(cross.status()).toBe(403);

    const [{ id }] = await sql<{ id: string }>(
      "select v.id from product_variants v join products p on p.id = v.product_id where p.slug = 'canvas-baseball-cap' and v.stock_quantity > 0 limit 1",
    );
    // Extra fields such as a price are ignored: the database prices the order.
    const res = await request.post("/api/orders", {
      data: {
        customer: { name: "Test Buyer", phone: "03001112233", address: "House 1, Street 2, Area 3", city: "Lahore" },
        items: [{ variantId: id, quantity: 1, price: 1 }],
        paymentMethod: "cod",
        total: 1,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.totalAmount).toBe(1549);
  });
});
