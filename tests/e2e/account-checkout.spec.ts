/**
 * Accounts + orders (proposal §2, §8 step 10): signed-in checkout pre-fill,
 * order history, owner-only order pages and guest tracking.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createCustomer, signIn } from "./auth-helpers";
import { sql } from "./db";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await sql("update product_variants set stock_quantity = 50 where product_id = (select id from products where slug = 'leather-bifold-wallet')");
});

async function addWalletToBag(page: Page) {
  await page.goto("/products/leather-bifold-wallet");
  const first = page.locator('input[type=radio][name^="size-"]:not([disabled])').first();
  const size = (await first.getAttribute("value"))!;
  await page.locator("label", { has: page.getByRole("radio", { name: size, exact: true }) }).click();
  await page.getByRole("button", { name: "Add to bag" }).first().click();
}

async function placeCod(page: Page) {
  await page.getByRole("radio", { name: /Cash on Delivery/ }).check();
  await page.getByRole("button", { name: /^Place order · / }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/orders\/MF-\d{6}-\d{5,}\?placed=1$/);
  return (await page.getByTestId("order-number").textContent())!.trim();
}

test("signed-in checkout is pre-filled from saved addresses and the order lands in the account", async ({ page, browser }) => {
  const user = await createCustomer({ name: "Zara Ahmed" });
  await sql(
    `insert into addresses (user_id, label, full_name, phone, address_line1, city, province, is_default) values
       ($1, 'Home', 'Zara Ahmed', '03011234567', 'House 22, Street 7, Bahria Town', 'Rawalpindi', 'Punjab', true),
       ($1, 'Office', 'Zara Ahmed', '03019876543', 'Floor 4, Blue Area Plaza', 'Islamabad', 'Islamabad Capital Territory', false)`,
    [user.id],
  );
  await signIn(page, user.email);
  await addWalletToBag(page);
  await page.goto("/checkout");
  await expect(page.getByTestId("checkout-account")).toContainText(user.email);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Zara Ahmed");
  await expect(page.getByLabel("Mobile number", { exact: true })).toHaveValue("0301 1234567");
  await expect(page.getByLabel("Delivery address", { exact: true })).toHaveValue("House 22, Street 7, Bahria Town");
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Rawalpindi");

  await page.getByRole("radio", { name: /Office/ }).check();
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Islamabad");
  await expect(page.getByLabel("Mobile number", { exact: true })).toHaveValue("0301 9876543");

  const number = await placeCod(page);
  const [row] = await sql<{ user_id: string; city: string }>("select user_id, city from orders where order_number = $1", [number]);
  expect(row).toEqual({ user_id: user.id, city: "Islamabad" });

  await expect(page.getByTestId("order-timeline")).toContainText("Pending");
  await page.goto("/account/orders");
  await expect(page.getByTestId("order-row").first()).toContainText(number);
  await expect(page.getByTestId("order-row").first()).toContainText("COD — Due");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);

  // The owner can open it from another device (no order cookie there).
  const device = await browser.newContext();
  const devicePage = await device.newPage();
  await signIn(devicePage, user.email, user.password, `/orders/${number}`);
  await expect(devicePage.getByTestId("order-number")).toHaveText(number);
  await device.close();

  // Another customer cannot.
  const stranger = await createCustomer();
  const otherCtx = await browser.newContext();
  const otherPage = await otherCtx.newPage();
  await signIn(otherPage, stranger.email, stranger.password, `/orders/${number}`);
  await expect(otherPage.getByRole("heading", { name: "We can’t show this order here" })).toBeVisible();
  await otherPage.goto("/account/orders");
  await expect(otherPage.getByText("No orders yet")).toBeVisible();
  await otherCtx.close();
});

test("guest orders can be tracked with order number + phone, and progress is shown", async ({ page, browser }) => {
  await addWalletToBag(page);
  await page.goto("/checkout");
  await page.getByLabel("Full name", { exact: true }).fill("Bilal Tariq");
  await page.getByLabel("Mobile number", { exact: true }).fill("0312 3456789");
  await page.getByLabel("Delivery address", { exact: true }).fill("House 3, Street 1, Saddar");
  await page.getByLabel("City", { exact: true }).fill("Peshawar");
  const number = await placeCod(page);

  // The store moves it on (admin screens come in Phase 7).
  await sql(
    `with o as (update orders set status = 'confirmed' where order_number = $1 returning id)
     insert into order_status_history (order_id, from_status, to_status) select id, 'pending', 'confirmed' from o`,
    [number],
  );

  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`/orders/${number}`);
  await expect(p.getByRole("heading", { name: "We can’t show this order here" })).toBeVisible();

  await p.goto("/track");
  const results = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
  await p.getByRole("button", { name: "Track order" }).click();
  await expect(p.getByText("Enter the order number exactly as shown")).toBeVisible();

  const notFound = "We couldn't find an order with that number and phone. Please check both and try again.";
  await p.getByLabel("Order number").fill(number.toLowerCase());
  await p.getByLabel("Mobile number used for the order").fill("0300 0000000");
  await p.getByRole("button", { name: "Track order" }).click();
  await expect(p.getByTestId("form-message")).toHaveText(notFound);
  await p.getByLabel("Order number").fill("MF-000101-99999");
  await p.getByLabel("Mobile number used for the order").fill("0312 3456789");
  await p.getByRole("button", { name: "Track order" }).click();
  await expect(p.getByTestId("form-message")).toHaveText(notFound);
  // What the customer typed is kept after a failed lookup.
  await expect(p.getByLabel("Mobile number used for the order")).toHaveValue("0312 3456789");

  await p.getByLabel("Order number").fill(number);
  await p.getByRole("button", { name: "Track order" }).click();
  // First render of the order page after a fresh build can take a moment.
  await expect(p).toHaveURL(new RegExp(`/orders/${number}$`), { timeout: 15_000 });
  await expect(p.getByTestId("order-number")).toHaveText(number);
  const timeline = p.getByTestId("order-timeline");
  await expect(timeline.locator('[aria-current="step"]')).toContainText("Confirmed");
  await expect(timeline).toContainText("Shipped");
  await ctx.close();
});
