import { expect, test } from "@playwright/test";

test("home page renders the store name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Mohsin FutureTech" })).toBeVisible();
  await expect(page).toHaveTitle(/Mohsin FutureTech/);
});

test("health endpoint responds", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("placeholder product images are served", async ({ request }) => {
  const res = await request.get("/placeholders/mens-quilted-puffer-jacket-1.svg");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("image/svg+xml");
});
