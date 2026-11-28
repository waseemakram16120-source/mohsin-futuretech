/**
 * Sales reports (proposal §5): totals, daily/monthly table, best sellers,
 * chart reading by keyboard, CSV export — on a date no other test uses.
 */
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createCustomer, signIn } from "./auth-helpers";
import { sql } from "./db";

const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Two orders of a fresh product on a past day (Pakistan time); one paid. */
async function seedDay(day: string) {
  const t = randomUUID().slice(0, 6).toUpperCase();
  const [p] = await sql<{ id: string }>(
    "insert into products (name, slug, base_price, audience, is_active) values ($1, $2, 3000, 'unisex', false) returning id",
    [`Report Item ${t}`, `report-item-${t.toLowerCase()}`],
  );
  const [v] = await sql<{ id: string }>(
    "insert into product_variants (product_id, sku, size, color, stock_quantity) values ($1, $2, 'M', 'Grey', 20) returning id",
    [p.id, `RPT-${t}`],
  );
  // place_order only sells active products: open it briefly.
  await sql("update products set is_active = true where id = $1", [p.id]);
  const customer = { name: "Report Buyer", phone: "03001112233", address: "House 1, Street 2, Saddar", city: "Karachi" };
  const orders: Array<{ order_id: string; total_amount: number }> = [];
  for (const qty of [2, 1]) {
    const [{ r }] = await sql<{ r: { order_id: string; total_amount: number } }>(
      "select public.place_order(null, $1, $2, 'cod', null) as r",
      [customer, JSON.stringify([{ variant_id: v.id, quantity: qty }])],
    );
    orders.push(r);
  }
  await sql("update products set is_active = false where id = $1", [p.id]);
  for (const [i, o] of orders.entries()) {
    await sql("update orders set created_at = ($1::timestamp at time zone 'Asia/Karachi') where id = $2", [`${day} ${10 + i}:00`, o.order_id]);
  }
  await sql("update orders set payment_status = 'paid', status = 'delivered' where id = $1", [orders[0].order_id]);
  return { name: `Report Item ${t}`, total: orders.reduce((n, o) => n + Number(o.total_amount), 0), paid: Number(orders[0].total_amount) };
}

const rs = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;

test("reports show totals, the daily table, best sellers and export a CSV", async ({ page, isMobile }) => {
  // Each device run uses its own day so they never overlap.
  const day = isMobile ? "2025-02-15" : "2025-02-14";
  const seeded = await seedDay(day);

  const admin = await createCustomer({ name: "Reports Admin" });
  await sql("update profiles set role = 'admin' where id = $1", [admin.id]);
  await signIn(page, admin.email, admin.password, `/admin/reports?range=custom&from=${day}&to=${day}`);

  const stats = page.getByTestId("report-stats");
  await expect(stats).toContainText(`Sales${rs(seeded.total)}`);
  await expect(stats).toContainText(`Payments received${rs(seeded.paid)}`);
  await expect(stats).toContainText("Orders placed2");
  await expect(page.getByTestId("best-sellers")).toContainText(`${seeded.name}3 sold`);
  await expect(page.getByTestId("period-table").locator("tbody tr")).toHaveCount(1);
  await expect(page.getByTestId("period-table").locator("tfoot")).toContainText(rs(seeded.total));
  const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`)).toEqual([]);

  // The chart can be read with the keyboard.
  await page.getByRole("application", { name: /Sales by day/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("chart-tooltip")).toContainText(rs(seeded.total));

  // Monthly view of the same month.
  await page.goto(`/admin/reports?range=custom&from=2025-02-01&to=2025-02-28&group=month`);
  await expect(page.getByTestId("period-table").locator("tbody tr")).toHaveCount(1);
  await expect(page.getByTestId("period-table").locator("tbody")).toContainText("February 2025");

  // CSV export.
  const csv = await page.request.get(`/admin/reports/export?range=custom&from=${day}&to=${day}`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(csv.headers()["content-disposition"]).toContain(`sales-report-${day}-to-${day}.csv`);
  const text = await csv.text();
  expect(text).toContain(`Sales (PKR),${seeded.total.toFixed(2)}`);
  expect(text).toContain(`${seeded.name},3,2,`);
});

test("customers cannot open reports or download the CSV", async ({ page }) => {
  const res = await page.request.get("/admin/reports/export?range=30d", { maxRedirects: 0 });
  expect(res.status()).toBe(403);
  const customer = await createCustomer();
  await signIn(page, customer.email, customer.password, "/admin/reports");
  await expect(page).toHaveURL(/\/access-denied$/);
  expect((await page.request.get("/admin/reports/export?range=30d")).status()).toBe(403);
});
