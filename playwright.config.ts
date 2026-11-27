import { execSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * E2E tests run against the LOCAL Supabase stack (`npm run db:start`) so they
 * never touch a real project. Its URL and demo keys are read from
 * `supabase status`; set E2E_USE_ENV=1 to use the current environment instead.
 */
function localSupabaseEnv(): Record<string, string> {
  if (process.env.E2E_USE_ENV === "1") return {};
  try {
    const out = execSync("npx --no-install supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: "docker.io" },
    });
    const vars = Object.fromEntries(
      out
        .split("\n")
        .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => [m[1], m[2]]),
    );
    return {
      NEXT_PUBLIC_SUPABASE_URL: vars.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: vars.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: vars.SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    };
  } catch {
    throw new Error("Local Supabase is not running. Start it with `npm run db:start`.");
  }
}

const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };
const mobile = { ...devices["Pixel 7"] };

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
  },
  projects: [
    { name: "desktop", testIgnore: /(checkout|payments)\.spec/, use: desktop },
    { name: "mobile", testIgnore: /(checkout|payments)\.spec/, use: mobile },
    // Checkout tests change stock, coupons and orders, so the two device
    // runs go one after the other instead of in parallel.
    { name: "checkout-desktop", testMatch: /(checkout|payments)\.spec/, use: desktop },
    { name: "checkout-mobile", testMatch: /(checkout|payments)\.spec/, use: mobile, dependencies: ["checkout-desktop"] },
  ],
  webServer: {
    // Tests run against a fresh production build, like Vercel.
    command: "bash scripts/serve-e2e.sh",
    url: `http://localhost:${PORT}/api/health`,
    // Tests place many orders from one IP, so relax the per-IP order limit.
    env: {
      ...localSupabaseEnv(),
      PORT: String(PORT),
      ORDER_RATE_LIMIT: "200",
      PAYMENT_RATE_LIMIT: "200",
      // Sandbox only: the internal test gateway stands in for JazzCash /
      // Easypaisa (whose adapters stay disabled until official docs arrive).
      PAYMENTS_ENV: "sandbox",
      PAYMENTS_TEST_GATEWAY: "1",
      // JazzCash exercises the online gateway path; Easypaisa stays on the
      // manual Transaction-ID + receipt flow (the production default).
      PAYMENTS_GATEWAY_METHODS: "jazzcash",
      PAYMENTS_PUBLIC_BASE_URL: `http://localhost:${PORT}`,
    },
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
