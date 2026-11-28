import { expect, test, type Page } from "@playwright/test";

const grid = (page: Page) => page.getByTestId("product-grid").getByTestId("product-card");
const priceOf = async (page: Page) =>
  (await grid(page).allInnerTexts()).map((t) => {
    const m = t.match(/Rs ([\d,]+)/);
    return m ? Number(m[1].replace(/,/g, "")) : NaN;
  });

async function openFilters(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("button", { name: /Filter & sort/ }).click();
    return page.getByRole("dialog", { name: "Filter & sort" });
  }
  return page.getByRole("complementary", { name: "Filters" });
}

test.describe("collection pages", () => {
  test("men's collection lists men + unisex products from the database", async ({ page }) => {
    await page.goto("/collections/men");
    await expect(page.getByRole("heading", { level: 1, name: "Men" })).toBeVisible();
    await expect(page.getByTestId("result-count")).toHaveText("10 products");
    await expect(grid(page)).toHaveCount(10);
    await expect(grid(page).filter({ hasText: "Leather Belt" })).toHaveCount(1); // unisex
    await expect(grid(page).filter({ hasText: "Women's" })).toHaveCount(0);
  });

  test("category collections and unknown collections", async ({ page }) => {
    await page.goto("/collections/jeans");
    await expect(page.getByRole("heading", { level: 1, name: "Jeans" })).toBeVisible();
    await expect(page.getByTestId("result-count")).toHaveText("4 products");
    const res = await page.goto("/collections/does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page took a detour" })).toBeVisible();
  });

  test("filters update the URL and results; chips remove them", async ({ page, isMobile }) => {
    await page.goto("/collections/jeans");
    const panel = await openFilters(page, isMobile);
    // The sr-only checkbox is toggled through its visible label.
    await panel.locator("label", { hasText: "Black" }).click();
    await expect(panel.getByRole("checkbox", { name: "Black" })).toBeChecked();
    await expect(page).toHaveURL(/color=Black/);
    await expect(page.getByTestId("result-count")).toHaveText("2 products");
    await panel.locator("label", { hasText: /^34$/ }).click();
    await expect(page).toHaveURL(/size=34/);
    await expect(page.getByTestId("result-count")).toHaveText("1 product");
    if (isMobile) await panel.getByRole("button", { name: /Show 1 result/ }).click();

    await expect(grid(page)).toHaveCount(1);
    await expect(grid(page).first()).toContainText("Men's Slim Fit Stretch Jeans");

    const chips = page.getByRole("group", { name: "Active filters" });
    await chips.getByRole("button", { name: "Remove filter: Size 34" }).click();
    await expect(page).not.toHaveURL(/size=34/);
    await expect(page.getByTestId("result-count")).toHaveText("2 products");
    await chips.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByTestId("result-count")).toHaveText("4 products");
  });

  test("a shared filtered URL restores the same view", async ({ page }) => {
    await page.goto("/shop?sale=1&min=3000&max=5000&sort=price-asc");
    const prices = await priceOf(page);
    expect(prices.length).toBeGreaterThan(0);
    expect(prices.every((p) => p >= 3000 && p <= 5000)).toBe(true);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    await expect(page.getByRole("group", { name: "Active filters" })).toContainText("On sale");
  });

  test("price filter form applies a range", async ({ page, isMobile }) => {
    await page.goto("/shop");
    const panel = await openFilters(page, isMobile);
    await panel.getByLabel("Min").fill("4000");
    await panel.getByLabel("Max").fill("8000");
    await panel.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/min=4000&max=8000/);
    if (isMobile) await panel.getByRole("button", { name: /Show \d+ results?/ }).click();
    const prices = await priceOf(page);
    expect(prices.every((p) => p >= 4000 && p <= 8000)).toBe(true);
  });

  test("sorting by price high to low", async ({ page, isMobile }) => {
    await page.goto("/shop");
    if (isMobile) {
      const panel = await openFilters(page, true);
      await panel.getByLabel("Sort by").selectOption("price-desc");
      await expect(page).toHaveURL(/sort=price-desc/);
      await panel.getByRole("button", { name: /Show/ }).click();
    } else {
      await page.getByLabel("Sort by").selectOption("price-desc");
      await expect(page).toHaveURL(/sort=price-desc/);
    }
    await expect(page.getByTestId("result-count")).toHaveText("17 products");
    const prices = await priceOf(page);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  test("filters that match nothing show a helpful empty state", async ({ page }) => {
    await page.goto("/collections/accessories?size=XL");
    await expect(page.getByRole("heading", { name: "No products match these filters" })).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/collections\/accessories$/);
    await expect(grid(page)).toHaveCount(3);
  });

  test("sale page only lists discounted products", async ({ page }) => {
    await page.goto("/sale");
    await expect(page.getByTestId("result-count")).toHaveText("6 products");
    for (const text of await grid(page).allInnerTexts()) expect(text).toMatch(/Original price/);
  });

  test("new arrivals lists new products, newest first", async ({ page }) => {
    await page.goto("/new-arrivals");
    await expect(page.getByTestId("result-count")).toHaveText("6 products");
  });
});

test.describe("search", () => {
  test("finds products by partial words and shows an empty state", async ({ page }) => {
    await page.goto("/search");
    const box = page.getByRole("searchbox", { name: "Search products" });
    await box.fill("puff jack");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=puff\+jack/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “puff jack”");
    await expect(grid(page)).toHaveCount(1);
    await expect(grid(page).first()).toContainText("Men's Quilted Puffer Jacket");

    await page.goto("/search?q=zzzqqq");
    await expect(page.getByRole("heading", { name: "Nothing here yet" })).toBeVisible();
  });

  test("search results can be filtered too", async ({ page }) => {
    await page.goto("/search?q=jackets&color=Black");
    await expect(page.getByTestId("result-count")).toHaveText("2 products");
  });

  test("header search icon opens the search page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Search" }).first().click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByRole("link", { name: "Jackets" }).last()).toBeVisible();
  });
});
