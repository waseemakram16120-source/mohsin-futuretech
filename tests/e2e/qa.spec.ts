/**
 * Final QA (Phase 9): security headers, broken links, no horizontal
 * scrolling at common screen sizes, no console/CSP errors, SEO files and
 * accessibility of the info pages.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PUBLIC_PAGES = [
  "/",
  "/shop",
  "/collections/men",
  "/collections/jackets",
  "/new-arrivals",
  "/sale",
  "/search?q=jeans",
  "/products/mens-quilted-puffer-jacket",
  "/cart",
  "/checkout",
  "/wishlist",
  "/track",
  "/login",
  "/signup",
  "/size-guide",
  "/shipping-returns",
  "/contact",
  "/privacy",
  "/terms",
];

test("security headers are sent on pages and APIs", async ({ request }) => {
  for (const path of ["/", "/products/leather-belt", "/api/health"]) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["x-frame-options"], path).toBe("DENY");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"], path).toContain("camera=()");
    const csp = h["content-security-policy"];
    for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]) {
      expect(csp, `${path}: ${directive}`).toContain(directive);
    }
    expect(h["x-powered-by"], path).toBeUndefined();
  }
});

test("no internal link leads to a missing page", async ({ request }) => {
  test.setTimeout(120_000);
  const seen = new Set<string>();
  const queue = ["/"];
  const broken: string[] = [];
  // Crawl public pages two levels deep (enough to reach every template).
  for (let depth = 0; depth < 2; depth++) {
    const next: string[] = [];
    for (const path of queue) {
      const res = await request.get(path);
      if (res.status() >= 400) {
        broken.push(`${path} → ${res.status()}`);
        continue;
      }
      if (!(res.headers()["content-type"] ?? "").includes("text/html")) continue;
      const html = await res.text();
      for (const m of html.matchAll(/href="(\/[^"#?]*)(?:\?[^"#]*)?"/g)) {
        const href = m[1];
        if (href.startsWith("/_next") || href.startsWith("/api") || /\.(svg|png|jpg|webp|woff2|ico|xml|txt)$/.test(href)) continue;
        if (!seen.has(href)) {
          seen.add(href);
          next.push(href);
        }
      }
    }
    queue.splice(0, queue.length, ...next);
  }
  for (const path of queue) {
    const res = await request.get(path);
    if (res.status() >= 400) broken.push(`${path} → ${res.status()}`);
  }
  expect(seen.size).toBeGreaterThan(30);
  expect(broken).toEqual([]);
});

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`no horizontal scrolling or console errors at ${width}px`, async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const problems: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !/Failed to load resource: the server responded with a status of 404/.test(msg.text())) problems.push(`${page.url()}: ${msg.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`${page.url()}: ${e.message}`));
    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      await page.waitForLoadState("load");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(0);
    }
    expect(problems).toEqual([]);
    await ctx.close();
  });
}

test("sitemap lists products and categories; robots keeps private areas out", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/products/leather-belt</loc>");
  expect(sitemap).toContain("/collections/jackets</loc>");
  expect(sitemap).toContain("/shipping-returns</loc>");
  expect(sitemap).not.toContain("/admin");
  expect(sitemap).not.toContain("/account");
  const robots = await (await request.get("/robots.txt")).text();
  for (const path of ["/admin", "/account", "/checkout", "/api/"]) expect(robots).toContain(`Disallow: ${path}`);
  expect(robots).toMatch(/Sitemap: http:\/\/localhost:\d+\/sitemap\.xml/);
});

for (const path of ["/shipping-returns", "/contact", "/privacy", "/terms"]) {
  test(`${path} renders with store details and no WCAG violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("policy-draft")).toBeVisible(); // until the owner confirms the wording
    if (path === "/shipping-returns") await expect(page.getByText("Rs 250")).toBeVisible();
    if (path === "/contact") await expect(page.getByRole("link", { name: "support@example.com" }).first()).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
}
