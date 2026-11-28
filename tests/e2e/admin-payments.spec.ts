/**
 * Admin dashboard (proposal §5–§8): access control, payment review and the
 * full order workflow from the customer's order to delivery.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createCustomer, localSupabase, signIn } from "./auth-helpers";
import { sql } from "./db";

// Whole-workflow tests: several orders and many admin steps each.
test.describe.configure({ mode: "serial", timeout: 90_000 });

const PRODUCT = "/products/mens-chino-trousers";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
let txnN = 0;
const txn = () => `AD${Date.now().toString().slice(-8)}${++txnN}${test.info().project.name.length}`;

test.beforeAll(async () => {
  await sql("update product_variants set stock_quantity = 50 where product_id = (select id from products where slug = 'mens-chino-trousers')");
});

async function createAdmin() {
  const admin = await createCustomer({ name: "Store Manager" });
  await sql("update profiles set role = 'admin' where id = $1", [admin.id]);
  return admin;
}

async function adminPage(browser: Browser) {
  const admin = await createAdmin();
  const ctx = await browser.newContext({ viewport: test.info().project.use.viewport ?? undefined, isMobile: test.info().project.use.isMobile, hasTouch: test.info().project.use.hasTouch });
  const page = await ctx.newPage();
  await signIn(page, admin.email, admin.password, "/admin");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  return { page, ctx, admin };
}

async function placeOrder(page: Page, method: "Easypaisa" | "Cash on Delivery") {
  await page.goto(PRODUCT);
  const first = page.locator('input[type=radio][name^="size-"]:not([disabled])').first();
  const size = (await first.getAttribute("value"))!;
  await page.locator("label", { has: page.getByRole("radio", { name: size, exact: true }) }).click();
  await page.getByRole("button", { name: "Add to bag" }).first().click();
  await page.goto("/checkout");
  await page.getByLabel("Full name", { exact: true }).fill("Kamran Akmal");
  await page.getByLabel("Mobile number", { exact: true }).fill("0333 5550001");
  await page.getByLabel("Delivery address", { exact: true }).fill("House 9, Street 2, Cantt Area");
  await page.getByLabel("City", { exact: true }).fill("Multan");
  await page.getByRole("radio", { name: new RegExp(method) }).check();
  await page.getByRole("button", { name: /^Place order · / }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/orders\/MF-\d{6}-\d{5,}\?placed=1$/);
  return (await page.getByTestId("order-number").textContent())!.trim();
}

async function submitEvidence(page: Page, id: string) {
  await page.getByLabel("Transaction ID").fill(id);
  await page.getByLabel("Payment receipt (screenshot)").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Submit payment details" }).click();
  await expect(page.getByTestId("payment-message")).toContainText("Pending Verification");
}

const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test("only admins can open the admin area", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Forders$/);

  const customer = await createCustomer();
  await signIn(page, customer.email, customer.password, "/admin/payments");
  await expect(page).toHaveURL(/\/access-denied$/);
  await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  await page.goto("/account");
  await expect(page.getByRole("link", { name: "Store admin" })).toHaveCount(0);

  // A customer cannot call the admin database functions directly either.
  const { API_URL, ANON_KEY } = localSupabase();
  const login = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: customer.email, password: customer.password }),
  });
  const { access_token } = (await login.json()) as { access_token: string };
  for (const [fn, body] of [
    ["admin_overview", {}],
    ["update_order_status", { p_order_id: "00000000-0000-4000-8000-000000000000", p_to: "confirmed" }],
    ["review_payment", { p_payment_id: "00000000-0000-4000-8000-000000000000", p_action: "approve" }],
  ] as const) {
    const res = await fetch(`${API_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status, fn).toBe(403);
  }
});

test("wallet order: reject with reason → customer resubmits → approve confirms → ship → deliver", async ({ page, browser }) => {
  const number = await placeOrder(page, "Easypaisa");
  const first = txn();
  await submitEvidence(page, first);

  const { page: admin, ctx } = await adminPage(browser);
  await expect(admin.getByText(/payments? waiting for verification/)).toBeVisible();
  let results = await new AxeBuilder({ page: admin }).withTags(wcag).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  // The order can't be confirmed before the payment is verified.
  await admin.goto(`/admin/orders/${number}`);
  await expect(admin.getByRole("button", { name: "Confirm order" })).toBeDisabled();
  await expect(admin.getByTestId("payment-txn")).toHaveText(first);
  const receipt = admin.getByRole("img", { name: `Payment receipt for ${number}` });
  await expect(receipt).toBeVisible();
  expect(await receipt.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  results = await new AxeBuilder({ page: admin }).withTags(wcag).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  // Reject from the payments queue: a reason is required.
  await admin.goto("/admin/payments");
  const item = admin.getByTestId("verify-item").filter({ hasText: number });
  await expect(item.getByRole("img")).toBeVisible();
  await item.getByRole("button", { name: "Reject…" }).click();
  await expect(item.getByRole("button", { name: "Reject payment" })).toBeDisabled();
  await item.getByLabel("Reason for rejecting (shown to the customer)").fill("Amount on the receipt is Rs 500 short.");
  await item.getByRole("button", { name: "Reject payment" }).click();
  await expect(admin.getByTestId("verify-item").filter({ hasText: number })).toHaveCount(0);

  // The customer sees the reason and sends corrected evidence.
  await page.reload();
  await expect(page.getByTestId("payment-message")).toContainText("Amount on the receipt is Rs 500 short.");
  const second = txn();
  await submitEvidence(page, second);

  // Approve → order confirmed automatically (proposal §6).
  await admin.goto(`/admin/orders/${number}`);
  await expect(admin.getByTestId("payment-record")).toHaveCount(2);
  await admin.getByRole("button", { name: "Approve payment" }).click();
  await expect(admin.getByTestId("review-message")).toHaveText("Payment approved.");
  await expect(admin.getByText("Approved", { exact: true }).first()).toBeVisible();
  await expect(admin.getByTestId("status-history")).toContainText("Confirmed");

  // Processing → shipped (with a courier note) → delivered.
  await admin.getByRole("button", { name: "Start processing" }).click();
  await expect(admin.getByTestId("status-message")).toHaveText("Order status updated.");
  await admin.getByLabel(/^Note/).fill("TCS 7788990011");
  await admin.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(admin.getByTestId("status-history")).toContainText("TCS 7788990011");
  await admin.getByRole("button", { name: "Mark as delivered" }).click();
  await expect(admin.getByTestId("status-history")).toContainText("Delivered");

  const [row] = await sql<{ status: string; payment_status: string }>("select status, payment_status from orders where order_number = $1", [number]);
  expect(row).toEqual({ status: "delivered", payment_status: "approved" });

  // The customer follows it on their order page (proposal §8 step 10).
  await page.reload();
  await expect(page.getByTestId("order-timeline").locator('[aria-current="step"]')).toContainText("Delivered");
  await expect(page.getByText("Payment: Approved")).toBeVisible();
  await ctx.close();
});

test("COD order: confirm, deliver, collect cash; cancelling restocks", async ({ page, browser }) => {
  const number = await placeOrder(page, "Cash on Delivery");
  const { page: admin, ctx } = await adminPage(browser);

  // Find it with search + filter.
  await admin.goto("/admin/orders");
  const filters = admin.getByRole("search", { name: "Filter orders" });
  await filters.getByLabel("Search").fill(number.slice(-5));
  await filters.getByLabel("Order status").selectOption("pending");
  await filters.getByRole("button", { name: "Apply" }).click();
  await expect(admin).toHaveURL(/status=pending/);
  const rows = admin.getByTestId(test.info().project.use.isMobile ? "admin-order-card" : "admin-order-row");
  await expect(rows.filter({ hasText: number })).toHaveCount(1);
  await admin.getByRole("link", { name: number }).first().click();
  await expect(admin.getByRole("heading", { name: number })).toBeVisible();

  for (const step of ["Confirm order", "Start processing", "Mark as shipped", "Mark as delivered"]) {
    await admin.getByRole("button", { name: step }).click();
    await expect(admin.getByTestId("status-message")).toHaveText("Order status updated.");
  }
  await admin.goto("/admin/payments");
  const cod = admin.getByTestId("cod-list").getByRole("listitem").filter({ hasText: number });
  admin.once("dialog", (d) => d.accept());
  await cod.getByRole("button", { name: "Mark as paid" }).click();
  await expect(admin.getByTestId("cod-list").getByRole("listitem").filter({ hasText: number })).toHaveCount(0);
  const [paid] = await sql<{ payment_status: string }>("select payment_status from orders where order_number = $1", [number]);
  expect(paid.payment_status).toBe("paid");

  // A second COD order is cancelled: its stock comes back.
  const other = await placeOrder(page, "Cash on Delivery");
  const stock = async () =>
    Number(
      (
        await sql<{ s: number }>(
          "select v.stock_quantity as s from order_items i join product_variants v on v.id = i.variant_id join orders o on o.id = i.order_id where o.order_number = $1",
          [other],
        )
      )[0].s,
    );
  const before = await stock();
  await admin.goto(`/admin/orders/${other}`);
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "Cancel order" }).click();
  await expect(admin.getByTestId("status-control")).toContainText("No further status changes");
  expect(await stock()).toBe(before + 1);
  await ctx.close();
});
