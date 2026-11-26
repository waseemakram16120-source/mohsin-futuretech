import { expect, test } from "@playwright/test";

test.describe("homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the hero and the key sections", async ({ page }) => {
    await expect(page).toHaveTitle(/Mohsin FutureTech/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Dressed for the city/);
    for (const name of ["Shop by category", "New arrivals", "Featured pieces", "Last chance to buy"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    await expect(page.getByRole("heading", { level: 2, name: /Up to \d+% off/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop Men", exact: true })).toHaveAttribute("href", "/collections/men");
  });

  test("loads real products and categories from the database", async ({ page }) => {
    const featured = page.getByRole("region", { name: "Featured pieces" });
    await expect(featured.getByTestId("product-card")).toHaveCount(4);
    // Seeded featured product with its seeded sale price.
    const puffer = featured.getByTestId("product-card").filter({ hasText: "Men's Quilted Puffer Jacket" });
    await expect(puffer).toContainText("Rs 7,999");
    await expect(puffer).toContainText("Rs 9,999");
    await expect(puffer).toContainText("−20%");

    const categories = page.getByRole("region", { name: "Shop by category" });
    await expect(categories.getByRole("link")).toHaveText([/Shop all/, "Jackets", "Jeans", "Shirts", "Trousers", "Accessories"]);

    // The honest sale headline matches the biggest seeded discount (20%).
    await expect(page.getByRole("heading", { name: "Up to 20% off selected styles" })).toBeVisible();
  });

  test("never shows inactive products", async ({ page }) => {
    await expect(page.getByText("Archived Bomber Jacket")).toHaveCount(0);
  });

  test("product cards link to product pages", async ({ page }) => {
    const card = page.getByRole("region", { name: "Featured pieces" }).getByTestId("product-card").first();
    await expect(card.getByRole("link")).toHaveAttribute("href", /^\/products\/[a-z0-9-]+$/);
  });
});

test.describe("layout", () => {
  test("announcement bar and footer use store settings", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Free delivery on orders of Rs 5,000 or more").first()).toBeVisible();
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("list", { name: "Payment methods" }).getByRole("listitem")).toHaveText([
      "Cash on Delivery",
      "JazzCash",
      "Easypaisa",
    ]);
    await expect(footer.getByRole("link", { name: "support@example.com" })).toBeVisible();
  });

  test("floating WhatsApp button opens a chat with the store number", async ({ page }) => {
    await page.goto("/");
    const wa = page.getByRole("link", { name: /Chat with us on WhatsApp/ });
    await expect(wa).toBeVisible();
    await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/923000000000\?text=/);
    await expect(wa).toHaveAttribute("rel", /noopener/);
  });

  test("skip link moves focus to the main content", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard navigation is a desktop concern");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("unknown pages show a friendly 404", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page took a detour" })).toBeVisible();
  });

  test("health endpoint responds", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBe(true);
  });
});

test.describe("desktop navigation", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("primary nav lists audiences, live categories and Sale", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link")).toHaveText([
      "New In", "Men", "Women", "Jackets", "Jeans", "Shirts", "Trousers", "Accessories", "Sale",
    ]);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  });
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");

  test("menu drawer opens, traps focus and closes with Escape", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
    const open = page.getByRole("button", { name: "Open menu" });
    await open.click();
    const dialog = page.getByRole("dialog", { name: "Mohsin FutureTech" });
    await expect(dialog).toBeVisible();
    // The drawer must cover the full screen height (regression: it was once
    // trapped inside the sticky header).
    const viewport = page.viewportSize()!;
    await expect.poll(async () => (await dialog.boundingBox())?.height).toBe(viewport.height);
    await expect(dialog.getByRole("link", { name: "Account" })).toBeInViewport();
    await expect(dialog.getByRole("link", { name: "Jackets" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close menu" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });

  test("menu links navigate and close the drawer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Sale" }).click();
    await expect(page).toHaveURL(/\/sale$/);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("no horizontal scrolling at phone width", async ({ page }) => {
    for (const width of [320, 375, 412]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(0);
    }
  });

  test("touch targets in the header are at least 44px", async ({ page }) => {
    await page.goto("/");
    for (const name of ["Open menu", "Wishlist", "Shopping bag"]) {
      const box = await page.getByRole("banner").getByRole(name === "Open menu" ? "button" : "link", { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
