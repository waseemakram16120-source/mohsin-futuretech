import { execSync } from "node:child_process";
import { sql } from "./db";

/** Test-only wallet accounts for the manual EasyPaisa flow (never real). */
export const TEST_WALLETS = {
  easypaisa: { name: "Test Store Easypaisa", number: "03451234567" },
  jazzcash: { name: "Test Store JazzCash", number: "03001234567" },
};

/**
 * Reset the LOCAL Supabase database to migrations + seed before the run, so
 * stock levels, coupon counts and orders are identical on every run.
 * Skip with E2E_SKIP_DB_RESET=1 (e.g. while iterating on one test).
 */
export default async function globalSetup() {
  if (process.env.E2E_SKIP_DB_RESET === "1" || process.env.E2E_USE_ENV === "1") return;
  execSync("npx --no-install supabase db reset", {
    stdio: "inherit",
    env: { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: "docker.io" },
  });
  // The seed leaves wallet accounts as placeholders (never offered to
  // customers); tests use clearly fake ones.
  await sql(
    `update store_settings set easypaisa_account_name = $1, easypaisa_account_number = $2,
            jazzcash_account_name = $3, jazzcash_account_number = $4 where id = 1`,
    [TEST_WALLETS.easypaisa.name, TEST_WALLETS.easypaisa.number, TEST_WALLETS.jazzcash.name, TEST_WALLETS.jazzcash.number],
  );
}
