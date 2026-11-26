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
