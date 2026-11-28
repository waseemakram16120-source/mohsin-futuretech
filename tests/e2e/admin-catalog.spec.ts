/**
 * Admin catalogue (proposal §5): products with photos and variants,
 * categories, inventory with audited adjustments, coupons, customers and
 * store settings — and that the shop reflects each change.
 */
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createCustomer, signIn } from "./auth-helpers";
import { sql } from "./db";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const tag = () => randomUUID().slice(0, 6);

async function signInAdmin(page: Page, next = "/admin") {
  const admin = await createCustomer({ name: "Catalogue Admin" });
  await sql("update profiles set role = 'admin' where id = $1", [admin.id]);
  await signIn(page, admin.email, admin.password, next);
  return admin;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`)).toEqual([]);
}

test("product: validate, create with variants, add a photo, edit, archive, delete", async ({ page }) => {
  test.setTimeout(90_000);
  await signInAdmin(page, "/admin/products/new");
  await axe(page);
  const name = `Test Bomber ${tag()}`;
  const form = page.getByRole("form", { name: "New product" });

  // Validation.
  await form.getByLabel("Price (Rs)", { exact: true }).fill("4000");
  await form.getByLabel("Was price (Rs) — shows a Sale badge (optional)").fill("3500");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByTestId("product-message")).toHaveText("Please correct the highlighted fields.");
  await expect(page.getByText("Enter the product name.")).toBeVisible();
  await expect(page.getByText("The 'was' price must be higher than the price (or leave it empty).")).toBeVisible();

  await form.getByLabel("Product name").fill(name);
  await expect(form.getByLabel("Web address")).toHaveValue(name.toLowerCase().replace(/ /g, "-"));
  await form.getByLabel("Was price (Rs) — shows a Sale badge (optional)").fill("5000");
  await form.getByLabel("Department").selectOption("men");
  await form.getByLabel("Category").selectOption({ label: "Jackets" });
  await form.getByLabel("Description").fill("A light bomber for cool evenings.");
  const rows = page.getByTestId("variant-row");
  await rows.nth(0).getByLabel("Size", { exact: true }).fill("M");
  await rows.nth(0).getByLabel("Colour", { exact: true }).fill("Olive");
  await rows.nth(0).getByLabel("Opening stock").fill("7");
  await page.getByRole("button", { name: "Add size / colour" }).click();
  await rows.nth(1).getByLabel("Size", { exact: true }).fill("M");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText("This size + colour is listed twice.")).toBeVisible();
  await rows.nth(1).getByLabel("Size", { exact: true }).fill("L");
  await rows.nth(1).getByLabel("Opening stock").fill("3");
  await page.getByRole("button", { name: "Create product" }).click();

  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}\?created=1$/);
  const productId = page.url().match(/products\/([0-9a-f-]{36})/)![1];
  const variants = await sql<{ size: string; stock_quantity: number; sku: string }>(
    "select size, stock_quantity, sku from product_variants where product_id = $1 order by sort_order",
    [productId],
  );
  expect(variants.map((v) => [v.size, v.stock_quantity])).toEqual([["M", 7], ["L", 3]]);
  expect(variants[0].sku).toMatch(/^TEST-BOMBER-[A-Z0-9]+-M-OLIVE-[A-Z0-9]{3}$/);
  // Opening stock is in the audit log.
  const [{ n }] = await sql<{ n: string }>(
    "select count(*) as n from inventory_movements m join product_variants v on v.id = m.variant_id where v.product_id = $1 and m.reason = 'initial'",
    [productId],
  );
  expect(n).toBe("2");

  // Photos: a fake image is refused; a real one is stored and shown.
  const images = page.getByTestId("product-images");
  await images.getByLabel("Add photos").setInputFiles({ name: "fake.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") });
  await images.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByTestId("images-message")).toHaveText("fake.jpg is not a JPG, PNG or WebP image.");
  await images.getByLabel("Add photos").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: PNG });
  await images.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByTestId("images-message")).toHaveText("Photo added.");
  await expect(page.getByTestId("product-image")).toHaveCount(1);
  await axe(page);

  // The shop shows it straight away, with the sale price and both sizes.
  const slug = name.toLowerCase().replace(/ /g, "-");
  await page.goto(`/products/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Rs 4,000").first()).toBeVisible();
  await expect(page.getByRole("radio", { name: "L", exact: true })).toBeVisible();
  // A single photo fills the gallery (no empty thumbnail column).
  const slide = page.locator('[aria-roledescription="slide"]').first();
  expect((await slide.boundingBox())!.width).toBeGreaterThan(250);

  // Edit: rename, switch a size off.
  await page.goto(`/admin/products/${productId}`);
  const edit = page.getByRole("form", { name: "Edit product" });
  await edit.getByLabel("Product name").fill(`${name} II`);
  await page.getByTestId("variant-row").nth(1).getByLabel("On sale in the shop").uncheck();
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page.getByTestId("product-message")).toHaveText("Product saved.");
  const [renamed] = await sql<{ name: string; slug: string }>("select name, slug from products where id = $1", [productId]);
  expect(renamed).toEqual({ name: `${name} II`, slug }); // slug kept, links don't break
  const ids = await sql<{ id: string; is_active: boolean }>("select id, is_active from product_variants where product_id = $1 order by sort_order", [productId]);
  expect(ids.map((v) => v.is_active)).toEqual([true, false]);

  // Archive hides it from the shop; then delete (never ordered).
  await page.getByRole("button", { name: "Archive product" }).click();
  await expect(page.getByText("Product archived — hidden from the shop.")).toBeVisible();
  const res = await page.request.get(`/products/${slug}`);
  expect(res.status()).toBe(404);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  expect(await sql("select id from products where id = $1", [productId])).toHaveLength(0);
});

test("a product that was ordered can be archived but not deleted", async ({ page }) => {
  await signInAdmin(page);
  const [ordered] = await sql<{ product_id: string }>("select product_id from order_items where product_id is not null limit 1");
  test.skip(!ordered, "needs an existing order");
  await page.goto(`/admin/products/${ordered.product_id}`);
  await expect(page.getByText("This product has orders, so it can't be deleted.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete permanently" })).toHaveCount(0);
});

test("categories: create, hide from the shop, delete", async ({ page }) => {
  await signInAdmin(page, "/admin/categories");
  await axe(page);
  const name = `Waistcoats ${tag()}`;
  await page.getByRole("button", { name: "Add category" }).click();
  const form = page.getByRole("form", { name: "New category" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Position in menus (lower first)").fill("50");
  await form.getByRole("button", { name: "Save category" }).click();
  await expect(page.getByTestId("category-notice")).toHaveText("Category created.");
  const slug = name.toLowerCase().replace(/ /g, "-");
  expect((await page.request.get(`/collections/${slug}`)).status()).toBe(200);

  const row = page.getByTestId("category-row").filter({ hasText: name });
  await row.getByRole("button", { name: `Edit ${name}` }).click();
  await page.getByRole("form", { name: `Edit ${name}` }).getByLabel("Visible in the shop").uncheck();
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(page.getByTestId("category-notice")).toHaveText("Category saved.");
  expect((await page.request.get(`/collections/${slug}`)).status()).toBe(404);

  // Categories with products can't be deleted (no button); this one can.
  await expect(page.getByTestId("category-row").filter({ hasText: "Jackets" }).getByRole("button", { name: /Delete/ })).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("category-row").filter({ hasText: name }).getByRole("button", { name: `Delete ${name}` }).click();
  await expect(page.getByTestId("category-notice")).toHaveText("Category deleted.");
});

test("inventory: add and remove stock with a reason; can't go below zero", async ({ page }) => {
  // A dedicated variant so parallel runs don't interfere.
  const t = tag().toUpperCase();
  const [p] = await sql<{ id: string }>(
    "insert into products (name, slug, base_price, audience) values ($1, $2, 1500, 'unisex') returning id",
    [`Stock Test ${t}`, `stock-test-${t.toLowerCase()}`],
  );
  await sql("insert into product_variants (product_id, sku, size, color, stock_quantity) values ($1, $2, 'One Size', 'Black', 2)", [p.id, `STK-${t}`]);

  await signInAdmin(page, `/admin/inventory?q=STK-${t}`);
  await axe(page);
  const row = page.getByTestId("inventory-row").filter({ hasText: `STK-${t}` });
  await expect(row.getByTestId("stock-qty")).toHaveText("2");
  await expect(row).toContainText("Low stock");

  await row.getByLabel(`Quantity for STK-${t}`).fill("10");
  await row.getByRole("button", { name: `Add stock to STK-${t}` }).click();
  await expect(row.getByRole("status")).toHaveText("Stock updated — now 12.");
  await expect(row.getByTestId("stock-qty")).toHaveText("12");

  await row.getByLabel(`Quantity for STK-${t}`).fill("20");
  await row.getByLabel(`Reason for STK-${t}`).selectOption("Damaged / faulty");
  await row.getByRole("button", { name: `Remove stock from STK-${t}` }).click();
  await expect(row.getByRole("alert")).toHaveText("Stock can't go below zero.");

  await row.getByLabel(`Quantity for STK-${t}`).fill("2");
  await row.getByRole("button", { name: `Remove stock from STK-${t}` }).click();
  await expect(row.getByTestId("stock-qty")).toHaveText("10");
  const log = await sql<{ change: number; note: string }>(
    "select m.change, m.note from inventory_movements m join product_variants v on v.id = m.variant_id where v.sku = $1 and m.reason = 'adjustment' order by m.created_at",
    [`STK-${t}`],
  );
  expect(log).toEqual([
    { change: 10, note: "New stock received" },
    { change: -2, note: "Damaged / faulty" },
  ]);
  await expect(page.getByTestId("stock-history")).toContainText(`STK-${t}`);
});

test("coupons: create, validate, and it works in the shop", async ({ page }) => {
  await signInAdmin(page, "/admin/coupons");
  await axe(page);
  const code = `T${tag().toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
  await page.getByRole("button", { name: "Add coupon" }).click();
  const form = page.getByRole("form", { name: "New coupon" });
  await form.getByLabel("Code").fill(code.toLowerCase());
  await form.getByLabel("Discount (%)").fill("95");
  await form.getByRole("button", { name: "Save coupon" }).click();
  await expect(page.getByText("Percentage discounts can be at most 90%.")).toBeVisible();
  await form.getByLabel("Discount (%)").fill("15");
  await form.getByLabel("Minimum order (Rs)").fill("1000");
  await form.getByLabel("Max uses (empty = unlimited)").fill("5");
  await form.getByRole("button", { name: "Save coupon" }).click();
  await expect(page.getByTestId("coupon-notice")).toHaveText("Coupon created.");
  await expect(page.getByTestId("coupon-row").filter({ hasText: code })).toContainText("15% off · min Rs 1,000 · used 0 / 5");

  const [check] = await sql<{ r: { valid: boolean; discount: number } }>("select public.validate_coupon($1, 2000) as r", [code]);
  expect(check.r).toMatchObject({ valid: true, discount: 300 });

  await page.getByRole("button", { name: `Edit ${code}` }).click();
  await page.getByRole("form", { name: `Edit ${code}` }).getByLabel("Active").uncheck();
  await page.getByRole("button", { name: "Save coupon" }).click();
  await expect(page.getByTestId("coupon-row").filter({ hasText: code })).toContainText("Off");
  const [off] = await sql<{ r: { valid: boolean } }>("select public.validate_coupon($1, 2000) as r", [code]);
  expect(off.r.valid).toBe(false);
});

test("customers: search and view a customer's details and orders", async ({ page }) => {
  const customer = await createCustomer({ name: `Nadia Shah ${tag()}` });
  await sql(
    "insert into addresses (user_id, label, full_name, phone, address_line1, city, is_default) values ($1, 'Home', 'Nadia Shah', '03451239876', 'House 4, Street 8, Clifton', 'Karachi', true)",
    [customer.id],
  );
  await signInAdmin(page, `/admin/customers?q=${encodeURIComponent(customer.email)}`);
  await axe(page);
  const row = page.getByTestId("customer-row").filter({ hasText: customer.email });
  await expect(row).toContainText("0 orders · Rs 0");
  await row.click();
  await expect(page.getByRole("heading", { name: /Nadia Shah/ })).toBeVisible();
  await expect(page.getByText("House 4, Street 8, Clifton")).toBeVisible();
  await expect(page.getByText("No orders yet")).toBeVisible();
  await axe(page);
});

test("settings: validated, saved and shown in the shop", async ({ page }) => {
  await signInAdmin(page, "/admin/settings");
  await axe(page);
  const [before] = await sql<{ store_address: string | null }>("select store_address from store_settings where id = 1");
  const form = page.getByRole("form", { name: "Store settings" });
  try {
    await form.getByLabel("WhatsApp number").fill("12345");
    await form.getByLabel("Delivery charge (Rs)").fill("-5");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Enter a Pakistani mobile number, e.g. 0300 1234567.")).toBeVisible();
    await expect(page.getByText("Can't be negative.")).toBeVisible();

    await form.getByLabel("WhatsApp number").fill("0300 0000000");
    await form.getByLabel("Delivery charge (Rs)").fill("250");
    const address = `Shop ${tag()}, Tariq Road, Karachi`;
    await form.getByLabel("Shop address").fill(address);
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByTestId("settings-message")).toHaveText("Settings saved. The shop shows the new details now.");
    await page.goto("/size-guide");
    await expect(page.getByRole("contentinfo")).toContainText(address);
  } finally {
    await sql("update store_settings set store_address = $1, whatsapp_number = '923000000000', delivery_charge = 250 where id = 1", [before.store_address]);
  }
});
