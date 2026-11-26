import { expect, test } from "@playwright/test";

const PUFFER = "/products/mens-quilted-puffer-jacket";

test.describe("product page", () => {
  test("shows gallery, price, variants and details", async ({ page }) => {
    await page.goto(PUFFER);
    await expect(page.getByRole("heading", { level: 1, name: "Men's Quilted Puffer Jacket" })).toBeVisible();
    await expect(page.getByText("Rs 9,999").first()).toBeVisible();
    await expect(page.getByRole("radio", { name: "Black" })).toBeChecked();
    await expect(page.getByTestId("sku")).toHaveText("—");
    await expect(page.getByTestId("stock-message")).toHaveText("Select a size to see availability");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Jackets");
    // Product structured data for search engines.
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
    expect(ld).toMatchObject({ "@type": "Product", name: "Men's Quilted Puffer Jacket" });
  });

  test("choosing colour and size updates SKU, stock and URL", async ({ page }) => {
    await page.goto(PUFFER);
    await page.locator("label", { has: page.getByRole("radio", { name: "Olive", exact: true }) }).click();
    await expect(page.getByTestId("selected-color")).toHaveText("Olive");
    // Seed: Olive M is sold out, Olive L has 9 in stock.
    await expect(page.getByRole("radio", { name: "M (sold out)" })).toBeDisabled();
    await page.locator("label", { has: page.getByRole("radio", { name: "L", exact: true }) }).click();
    await expect(page.getByTestId("selected-size")).toHaveText("L");
    await expect(page.getByTestId("sku")).toHaveText("JKT-001-L-OLIV");
    await expect(page.getByTestId("stock-message")).toHaveText("In stock — ready to ship");
    await expect(page).toHaveURL(/color=Olive&size=L/);
  });

  test("a variant in the URL is pre-selected", async ({ page }) => {
    await page.goto(`${PUFFER}?color=Black&size=XL`);
    await expect(page.getByTestId("sku")).toHaveText("JKT-001-XL-BLAC");
    await expect(page.getByTestId("stock-message")).toHaveText("Only 3 left — order soon");
    // A shared link to a sold-out variant explains itself instead of selling it.
    await page.goto(`${PUFFER}?color=Olive&size=M`);
    await expect(page.getByTestId("stock-message")).toHaveText("Sold out in this size");
    await expect(page.getByRole("button", { name: "Sold out in this size" }).first()).toBeDisabled();
  });

  test("sold-out sizes cannot be chosen", async ({ page }) => {
    // Find a seeded product whose default colour has a sold-out size.
    let found = false;
    for (const slug of ["womens-high-rise-skinny-jeans", "mens-oxford-button-down-shirt", "mens-chino-trousers", "womens-belted-trench-coat", "leather-belt", "mens-linen-blend-shirt"]) {
      await page.goto(`/products/${slug}`);
      const disabled = page.locator('input[type=radio][name^="size-"]:disabled');
      if ((await disabled.count()) === 0) continue;
      found = true;
      await expect(disabled.first()).toHaveAttribute("aria-label", /sold out/);
      await expect(disabled.first()).not.toBeChecked();
      break;
    }
    expect(found, "seed data should contain a sold-out size").toBe(true);
  });

  test("add to bag requires a size, then updates the bag count", async ({ page }) => {
    await page.goto(PUFFER);
    const add = page.getByRole("button", { name: "Add to bag" }).first();
    await add.click();
    await expect(page.getByText("Please select a size.")).toBeVisible();
    await page.locator('label:has(input[type=radio][name^="size-"]:not([disabled]))').first().click();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await add.click();
    await expect(page.getByText(/Added to your bag/)).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("2");
    await expect(page.getByRole("banner").getByRole("link", { name: "Shopping bag, 2 items" })).toBeVisible();
    // The bag survives a reload (stored in the browser).
    await page.reload();
    await expect(page.getByTestId("cart-count")).toHaveText("2");
  });

  test("size guide opens as a dialog and closes with Escape", async ({ page }) => {
    await page.goto(PUFFER);
    await page.getByRole("button", { name: "Size guide" }).click();
    const dialog = page.getByRole("dialog", { name: "Size guide" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("columnheader", { name: "Chest" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("related products and unknown products", async ({ page }) => {
    await page.goto(PUFFER);
    const related = page.getByRole("region", { name: "More jackets" });
    await expect(related.getByTestId("product-card")).toHaveCount(3);
    await expect(related).not.toContainText("Men's Quilted Puffer Jacket");
    const res = await page.goto("/products/archived-bomber-jacket");
    expect(res?.status()).toBe(404); // inactive → real 404, not a soft 404
    await expect(page.getByRole("heading", { name: "This product is no longer available" })).toBeVisible();
  });

  test("mobile: sticky add-to-bag bar appears when the main button scrolls away", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto(PUFFER);
    const bar = page.getByTestId("sticky-add-to-bag");
    await page.getByRole("button", { name: "Add to bag" }).first().scrollIntoViewIfNeeded();
    await expect(bar).toHaveAttribute("aria-hidden", "true");
    await page.getByRole("heading", { name: "More jackets" }).scrollIntoViewIfNeeded();
    await expect(bar).toHaveAttribute("aria-hidden", "false");
    await expect(bar).toBeInViewport();
    await bar.getByRole("button", { name: "Select size" }).click();
    await expect(page.getByText("Please select a size.")).toBeVisible();
  });

  test("mobile: gallery dots switch images", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto(PUFFER);
    const dots = page.getByRole("button", { name: /Show image 2 of 2/ });
    await dots.last().click();
    await expect(dots.last()).toHaveAttribute("aria-current", "true");
  });
});

test.describe("wishlist", () => {
  test("save from a card, view on /wishlist, remove", async ({ page }) => {
    await page.goto("/wishlist");
    await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeVisible();

    await page.goto("/collections/jackets");
    const save = page.getByRole("button", { name: "Save Men's Quilted Puffer Jacket to wishlist" });
    await save.click();
    await expect(page.getByRole("button", { name: "Remove Men's Quilted Puffer Jacket from wishlist" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("wishlist-count")).toHaveText("1");

    await page.getByRole("banner").getByRole("link", { name: /Wishlist, 1 saved/ }).click();
    await expect(page).toHaveURL(/\/wishlist$/);
    const cards = page.getByTestId("wishlist-grid").getByTestId("product-card");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Men's Quilted Puffer Jacket");

    await page.getByRole("button", { name: "Remove Men's Quilted Puffer Jacket from wishlist" }).click();
    await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeVisible();
  });

  test("save from the product page", async ({ page }) => {
    await page.goto(PUFFER);
    await page.getByRole("button", { name: "Save Men's Quilted Puffer Jacket to wishlist" }).click();
    await expect(page.getByTestId("wishlist-count")).toHaveText("1");
  });

  test("products API validates input", async ({ request }) => {
    expect((await request.get("/api/products?ids=not-a-uuid")).status()).toBe(400);
    expect((await request.get("/api/products")).status()).toBe(400);
  });
});
