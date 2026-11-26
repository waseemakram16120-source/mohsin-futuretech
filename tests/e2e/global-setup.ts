import { execSync } from "node:child_process";

/**
 * Reset the LOCAL Supabase database to migrations + seed before the run, so
 * stock levels, coupon counts and orders are identical on every run.
 * Skip with E2E_SKIP_DB_RESET=1 (e.g. while iterating on one test).
 */
export default function globalSetup() {
  if (process.env.E2E_SKIP_DB_RESET === "1" || process.env.E2E_USE_ENV === "1") return;
  execSync("npx --no-install supabase db reset", {
    stdio: "inherit",
    env: { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: "docker.io" },
  });
}
