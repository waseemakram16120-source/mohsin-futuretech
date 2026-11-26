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

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Tests run against a fresh production build, like Vercel.
    command: "bash scripts/serve-e2e.sh",
    url: `http://localhost:${PORT}/api/health`,
    env: { ...localSupabaseEnv(), PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
