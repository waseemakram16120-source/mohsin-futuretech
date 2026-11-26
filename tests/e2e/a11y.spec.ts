import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const path of [
  "/",
  "/this-page-does-not-exist",
  "/collections/men",
  "/shop?size=M&color=Black&stock=1",
  "/search?q=jacket",
  "/search",
  "/products/mens-quilted-puffer-jacket",
  "/wishlist",
  "/size-guide",
]) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect(summary).toEqual([]);
  });
}

test("mobile menu has no violations when open", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("filter sheet and size guide dialogs have no violations", async ({ page, isMobile }) => {
  await page.goto("/products/mens-quilted-puffer-jacket");
  await page.getByRole("button", { name: "Size guide" }).click();
  await expect(page.getByRole("dialog", { name: "Size guide" })).toBeVisible();
  let results = await new AxeBuilder({ page }).include("dialog[open]").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  if (isMobile) {
    await page.goto("/collections/men");
    await page.getByRole("button", { name: /Filter & sort/ }).click();
    await expect(page.getByRole("dialog", { name: "Filter & sort" })).toBeVisible();
    results = await new AxeBuilder({ page }).include("dialog[open]").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  }
});

test("bag, checkout (with errors) and order confirmation have no violations", async ({ page }) => {
  const scan = async () => {
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  };
  // Uses the belt (not touched by the checkout tests running alongside).
  await page.goto("/products/leather-belt");
  const first = page.locator('input[type=radio][name^="size-"]:not([disabled])').first();
  const size = (await first.getAttribute("value"))!;
  await page.locator("label", { has: page.getByRole("radio", { name: size, exact: true }) }).click();
  await page.getByRole("button", { name: "Add to bag" }).first().click();

  await page.goto("/cart");
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  expect(await scan()).toEqual([]);

  await page.goto("/checkout");
  await page.getByRole("button", { name: /Place order/ }).filter({ visible: true }).click();
  await expect(page.getByText("Please fix")).toBeVisible();
  expect(await scan()).toEqual([]);

  await page.getByLabel("Full name", { exact: true }).fill("Accessibility Tester");
  await page.getByLabel("Mobile number", { exact: true }).fill("03001234567");
  await page.getByLabel("Delivery address", { exact: true }).fill("House 9, Street 9, Model Town");
  await page.getByLabel("City", { exact: true }).fill("Lahore");
  await page.getByRole("radio", { name: /Cash on Delivery/ }).check();
  await page.getByRole("button", { name: /Place order/ }).filter({ visible: true }).click();
  await expect(page.getByTestId("order-number")).toBeVisible();
  expect(await scan()).toEqual([]);
});
