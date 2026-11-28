/**
 * Online payment flow end-to-end (payment spec §13) using the INTERNAL
 * sandbox test gateway — not JazzCash/Easypaisa sandboxes, which are blocked
 * on official documentation and credentials (see docs/PAYMENTS.md).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { sql } from "./db";

test.describe.configure({ mode: "serial" });

// Each device run places several belt orders; start every run with stock.
test.beforeAll(async () => {
  await sql("update product_variants set stock_quantity = 50 where product_id = (select id from products where slug = 'leather-belt')");
});

const BELT = "/products/leather-belt"; // Rs 1,999 → total 2,249 with delivery

async function orderWithGateway(page: Page, method: "JazzCash" | "Easypaisa" = "JazzCash") {
  await page.goto(BELT);
  const first = page.locator('input[type=radio][name^="size-"]:not([disabled])').first();
  const size = (await first.getAttribute("value"))!;
  await page.locator("label", { has: page.getByRole("radio", { name: size, exact: true }) }).click();
  await page.getByRole("button", { name: "Add to bag" }).first().click();
  await page.goto("/checkout");
  await page.getByLabel("Full name", { exact: true }).fill("Bilal Ahmed");
  await page.getByLabel("Mobile number", { exact: true }).fill("0333 1234567");
  await page.getByLabel("Delivery address", { exact: true }).fill("House 7, Street 3, F-8/2");
  await page.getByLabel("City", { exact: true }).fill("Islamabad");
  await page.getByRole("radio", { name: new RegExp(method) }).check();
  await page.getByRole("button", { name: /Place order & pay/ }).filter({ visible: true }).click();
  // Straight to the hosted (test) gateway.
  await expect(page).toHaveURL(/\/payments\/test-gateway\?ref=[A-Z0-9]{20}$/);
  await expect(page.getByRole("note")).toContainText("SANDBOX TEST GATEWAY");
  const orderNumber = (await page.locator("dd.font-mono").first().textContent())!.trim();
  return orderNumber;
}

async function dbState(orderNumber: string) {
  const [row] = await sql<{ payment_status: string; status: string; attempts: string[] }>(
    `select o.payment_status, o.status,
            array(select a.status::text from payment_attempts a where a.order_id = o.id order by a.created_at) as attempts
       from orders o where o.order_number = $1`,
    [orderNumber],
  );
  return row;
}

test("checkout offers COD, JazzCash and Easypaisa only", async ({ page }) => {
  await page.goto(BELT);
  const first = page.locator('input[type=radio][name^="size-"]:not([disabled])').first();
  const size = (await first.getAttribute("value"))!;
  await page.locator("label", { has: page.getByRole("radio", { name: size, exact: true }) }).click();
  await page.getByRole("button", { name: "Add to bag" }).first().click();
  await page.goto("/checkout");
  const radios = page.getByRole("group", { name: "Payment" }).getByRole("radio");
  await expect(radios).toHaveCount(3);
  await expect(page.getByText("NayaPay")).toHaveCount(0);
  await expect(page.getByRole("contentinfo").getByRole("list", { name: "Payment methods" }).getByRole("listitem")).toHaveText([
    "Cash on Delivery",
    "JazzCash",
    "Easypaisa",
  ]);
  await page.goto("/cart");
  await page.getByRole("button", { name: /Remove Leather Belt/ }).click();
});

test("successful payment: verified callback marks the order paid and confirmed", async ({ page }) => {
  const number = await orderWithGateway(page, "JazzCash");
  expect(await dbState(number)).toMatchObject({ payment_status: "awaiting_payment", attempts: ["pending"] });

  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${number}\\?payment=return$`));
  await expect(page.getByTestId("payment-message")).toContainText("Payment confirmed.");
  await expect(page.getByText("Payment: Paid")).toBeVisible();
  await expect(page.getByText("Order: Confirmed")).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay|Try again/ })).toHaveCount(0);
  expect(await dbState(number)).toMatchObject({ payment_status: "paid", status: "confirmed", attempts: ["paid"] });
});

test("failed and cancelled payments stay unpaid and can be retried without a duplicate attempt", async ({ page }) => {
  const number = await orderWithGateway(page, "JazzCash");
  await page.getByRole("button", { name: "Simulate failed payment" }).click();
  await expect(page.getByTestId("payment-message")).toContainText("Payment could not be completed");
  expect(await dbState(number)).toMatchObject({ payment_status: "awaiting_payment", attempts: ["failed"] });

  await page.getByRole("button", { name: /Try again Rs 2,249 with JazzCash/ }).click();
  await expect(page).toHaveURL(/\/payments\/test-gateway/);
  await page.getByRole("button", { name: "Simulate customer cancel" }).click();
  await expect(page.getByTestId("payment-message")).toContainText("Payment was cancelled");
  expect((await dbState(number)).attempts.sort()).toEqual(["cancelled", "failed"]);
});

test("pending payment shows 'do not retry' and offers no second payment", async ({ page }) => {
  const number = await orderWithGateway(page);
  await page.getByRole("button", { name: "Simulate pending (no decision yet)" }).click();
  await expect(page.getByTestId("payment-message")).toContainText("Payment is being processed. Please do not retry yet.");
  await expect(page.getByRole("button", { name: /Pay|Try again/ })).toHaveCount(0);
  // The API refuses a second charge while the first is unresolved.
  const res = await page.request.post("/api/payments/initiate", { data: { orderNumber: number } });
  expect(res.status()).toBe(409);
  expect(await dbState(number)).toMatchObject({ payment_status: "awaiting_payment", attempts: ["pending"] });
});

test("tampered, replayed and forged callbacks never mark an order paid", async ({ page }) => {
  const number = await orderWithGateway(page);
  const form = page.locator("form", { has: page.getByRole("button", { name: "Simulate successful payment" }) });
  const fields = Object.fromEntries(
    await form.locator("input[type=hidden]").evaluateAll((els) => els.map((e) => [(e as HTMLInputElement).name, (e as HTMLInputElement).value])),
  ) as Record<string, string>;

  // 1. Amount tampered to Rs 1 → signature fails.
  let res = await page.request.post("/api/payments/callback/test", { form: { ...fields, amount_minor: "100" }, maxRedirects: 0 });
  expect(res.status()).toBe(303);
  expect(await dbState(number)).toMatchObject({ payment_status: "awaiting_payment" });
  // 2. Forged signature.
  res = await page.request.post("/api/payments/callback/test", { form: { ...fields, signature: "0".repeat(64) }, maxRedirects: 0 });
  expect(await dbState(number)).toMatchObject({ payment_status: "awaiting_payment" });
  // 3. Callbacks for the disabled real providers are rejected outright.
  for (const provider of ["jazzcash", "easypaisa"]) {
    res = await page.request.post(`/api/payments/callback/${provider}`, { form: { pp_ResponseCode: "000", orderRefNum: fields.reference }, maxRedirects: 0 });
    expect(res.status()).toBe(303);
  }
  expect(await dbState(number)).toMatchObject({ payment_status: "awaiting_payment" });
  // 4. "Success" in the return URL means nothing.
  await page.goto(`/orders/${number}?payment=return&status=success&paid=1`);
  await expect(page.getByTestId("payment-message")).not.toContainText("Payment confirmed");

  // 5. The genuine message, then the same message replayed.
  res = await page.request.post("/api/payments/callback/test", { form: fields, maxRedirects: 0 });
  expect(await dbState(number)).toMatchObject({ payment_status: "paid" });
  const eventsFor = () =>
    sql<{ outcome: string; reason: string | null }>(
      `select e.outcome, e.reason from payment_events e join payment_attempts a on a.id = e.attempt_id
         join orders o on o.id = a.order_id where o.order_number = $1 order by e.created_at`,
      [number],
    );
  const before = await eventsFor();
  res = await page.request.post("/api/payments/callback/test", { form: fields, maxRedirects: 0 });
  expect(res.status()).toBe(303);
  // The replay is absorbed by the durable unique dedupe key: no new event,
  // no second status change, the order is confirmed exactly once.
  expect(await eventsFor()).toEqual(before);
  expect(before.map((e) => e.outcome)).toEqual(["applied", "rejected", "rejected", "applied"]);
  expect(before.filter((e) => e.reason === "invalid_signature")).toHaveLength(2);
  const [{ n }] = await sql<{ n: number }>(
    `select count(*)::int as n from order_status_history h join orders o on o.id = h.order_id
      where o.order_number = $1 and h.to_status = 'confirmed'`,
    [number],
  );
  expect(n).toBe(1);
});

test("payment initiation is protected: ownership, strict body, origin", async ({ page, browser }) => {
  const number = await orderWithGateway(page);
  // Another browser (no order cookie) cannot start or read payment for it.
  const stranger = await browser.newContext();
  const other = await stranger.newPage();
  expect((await other.request.post("/api/payments/initiate", { data: { orderNumber: number } })).status()).toBe(404);
  expect((await other.request.get(`/api/payments/status?order=${number}`)).status()).toBe(404);
  await stranger.close();
  // The client cannot send an amount or status.
  const extra = await page.request.post("/api/payments/initiate", { data: { orderNumber: number, amount: 1, status: "paid" } });
  expect(extra.status()).toBe(400);
  const cross = await page.request.post("/api/payments/initiate", { data: { orderNumber: number }, headers: { Origin: "https://evil.example" } });
  expect(cross.status()).toBe(403);
  // Someone else's order number is indistinguishable from a missing one.
  const others = await sql<{ order_number: string }>("select order_number from orders where order_number <> $1 limit 1", [number]);
  if (others.length) {
    expect((await page.request.post("/api/payments/initiate", { data: { orderNumber: others[0].order_number } })).status()).toBe(404);
  }
});

test("order page and test gateway are accessible", async ({ page }) => {
  await orderWithGateway(page);
  let r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "Simulate failed payment" }).click();
  await expect(page.getByTestId("payment-panel")).toBeVisible();
  r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

test("no payment secrets in the browser bundle", async () => {
  const dir = join(process.cwd(), ".next", "static");
  const files: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|css|html|json)$/.test(name)) files.push(p);
    }
  };
  walk(dir);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const forbidden = ["SUPABASE_SERVICE_ROLE_KEY", "JAZZCASH_PASSWORD", "JAZZCASH_INTEGRITY_SALT", "EASYPAISA_HASH_KEY", "mft-test-gateway-v1", "mft-order-access-cookie-v1"];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const f of forbidden) expect(text.includes(f), `${f} in ${file}`).toBe(false);
    if (serviceKey) expect(text.includes(serviceKey), `service key in ${file}`).toBe(false);
  }
  expect(files.length).toBeGreaterThan(5);
});
