/**
 * The complete store workflow from the proposal (§8, steps 1–10) in one run,
 * on desktop and mobile: a customer signs up, shops, pays with Easypaisa and
 * uploads a receipt; the admin verifies it, ships and delivers; the
 * customer follows it in their account. Also checks that account and admin
 * pages never scroll sideways.
 */
import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, createCustomer, signIn, uniqueEmail } from "./auth-helpers";
import { sql } from "./db";

test.describe.configure({ timeout: 120_000 });

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${page.url()} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}

test("customer → order → receipt → admin approves → ships → delivers → customer sees it", async ({ page, browser }) => {
  await sql("update product_variants set stock_quantity = 50 where product_id = (select id from products where slug = 'womens-wide-leg-jeans')");

  // 1. Sign up.
  const email = uniqueEmail("golden");
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Mahnoor Iqbal");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  // 2–3. Browse women's collection, open a product, choose size, add to bag.
  await page.goto("/collections/women");
  await page.getByRole("link", { name: /Women's Wide-Leg Jeans/ }).first().click();
  await expect(page).toHaveURL(/\/products\/womens-wide-leg-jeans/);
  const first = page.locator('input[type=radio][name^="size-"]:not([disabled])').first();
  const size = (await first.getAttribute("value"))!;
  await page.locator("label", { has: page.getByRole("radio", { name: size, exact: true }) }).click();
  await page.getByRole("button", { name: "Add to bag" }).first().click();
  await page.goto("/cart");
  await expect(page.getByText("Women's Wide-Leg Jeans").first()).toBeVisible();
  await noSideScroll(page);

  // 4–5. Checkout as the signed-in customer; pay with Easypaisa.
  await page.goto("/checkout");
  await expect(page.getByTestId("checkout-account")).toContainText(email);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Mahnoor Iqbal");
  await page.getByLabel("Mobile number", { exact: true }).fill("0321 4445566");
  await page.getByLabel("Delivery address", { exact: true }).fill("House 18, Street 6, Johar Town");
  await page.getByLabel("City", { exact: true }).fill("Lahore");
  await page.getByRole("radio", { name: /Easypaisa/ }).check();
  await page.getByRole("button", { name: /^Place order · / }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/orders\/MF-\d{6}-\d{5,}\?placed=1$/);
  const number = (await page.getByTestId("order-number").textContent())!.trim();

  // 6. Send the Transaction ID and receipt.
  await page.getByLabel("Transaction ID").fill(`GP${Date.now().toString().slice(-9)}${test.info().project.name.length}`);
  await page.getByLabel("Payment receipt (screenshot)").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Submit payment details" }).click();
  await expect(page.getByTestId("payment-message")).toContainText("Pending Verification");
  await noSideScroll(page);

  // 7–9. Admin reviews, approves, prepares, ships and delivers.
  const admin = await createCustomer({ name: "Golden Admin" });
  await sql("update profiles set role = 'admin' where id = $1", [admin.id]);
  const adminCtx = await browser.newContext({
    viewport: test.info().project.use.viewport ?? undefined,
    isMobile: test.info().project.use.isMobile,
    hasTouch: test.info().project.use.hasTouch,
  });
  const a = await adminCtx.newPage();
  await signIn(a, admin.email, admin.password, "/admin/payments");
  await noSideScroll(a);
  const item = a.getByTestId("verify-item").filter({ hasText: number });
  await expect(item.getByRole("img")).toBeVisible();
  await item.getByRole("button", { name: "Approve payment" }).click();
  await expect(a.getByTestId("verify-item").filter({ hasText: number })).toHaveCount(0);

  await a.goto(`/admin/orders/${number}`);
  await noSideScroll(a);
  await expect(a.getByTestId("status-history")).toContainText("Confirmed");
  for (const step of ["Start processing", "Mark as shipped", "Mark as delivered"]) {
    await a.getByRole("button", { name: step }).click();
    await expect(a.getByTestId("status-message")).toHaveText("Order status updated.");
  }
  await expect(a.getByTestId("status-history")).toContainText("Delivered");
  for (const path of ["/admin", "/admin/orders", "/admin/products", "/admin/inventory", "/admin/reports", "/admin/settings"]) {
    await a.goto(path);
    await noSideScroll(a);
  }
  await adminCtx.close();

  // 10. The customer follows it in their account.
  await page.goto("/account/orders");
  const row = page.getByTestId("order-row").filter({ hasText: number });
  await expect(row).toContainText("Delivered");
  await expect(row).toContainText("Approved");
  await noSideScroll(page);
  await row.click();
  await expect(page.getByTestId("order-timeline").locator('[aria-current="step"]')).toContainText("Delivered");

  const [db] = await sql<{ status: string; payment_status: string; user_email: string }>(
    "select o.status, o.payment_status, p.email as user_email from orders o join profiles p on p.id = o.user_id where o.order_number = $1",
    [number],
  );
  expect(db).toEqual({ status: "delivered", payment_status: "approved", user_email: email });
});

test("a returning customer signs in from checkout and comes back to it", async ({ page }) => {
  const customer = await createCustomer({ name: "Returning Buyer" });
  await page.goto("/products/leather-belt");
  const first = page.locator('input[type=radio][name^="size-"]:not([disabled])').first();
  const size = (await first.getAttribute("value"))!;
  await page.locator("label", { has: page.getByRole("radio", { name: size, exact: true }) }).click();
  await page.getByRole("button", { name: "Add to bag" }).first().click();
  await page.goto("/checkout");
  await page.getByRole("link", { name: "Sign in" }).filter({ visible: true }).last().click();
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)checkout$/);
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByTestId("checkout-account")).toContainText(customer.email);
  // The bag survived signing in.
  await expect(page.getByText("Leather Belt").first()).toBeVisible();
});
