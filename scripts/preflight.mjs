#!/usr/bin/env node
/**
 * Pre-launch check for a Supabase project + site configuration.
 *
 *   node --env-file=.env.production.local scripts/preflight.mjs [--site https://your-domain]
 *   npm run preflight -- --site https://your-domain      (env already exported)
 *
 * Read-only: it never writes to the database. Exit code 1 when a blocking
 * problem is found. Secrets are never printed.
 */

const args = process.argv.slice(2);
const siteArg = args.includes("--site") ? args[args.indexOf("--site") + 1] : null;
const allowHttp = args.includes("--allow-http"); // local rehearsal only

let failures = 0;
let warnings = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};
const warn = (msg) => {
  warnings++;
  console.log(`  ! ${msg}`);
};
const section = (title) => console.log(`\n${title}`);

const env = process.env;
const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const service = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const site = (env.NEXT_PUBLIC_SITE_URL ?? "").trim();

function jwtRole(token) {
  try {
    const part = token.split(".")[1];
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}

section("Environment variables");
for (const [name, value] of [
  ["NEXT_PUBLIC_SUPABASE_URL", url],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anon],
  ["SUPABASE_SERVICE_ROLE_KEY", service],
  ["NEXT_PUBLIC_SITE_URL", site],
]) {
  if (value) ok(`${name} is set`);
  else fail(`${name} is missing`);
}
const https = (v) => v.startsWith("https://") || (allowHttp && v.startsWith("http://"));
if (url && !https(url)) fail("NEXT_PUBLIC_SUPABASE_URL must start with https://");
if (site) {
  if (!https(site)) fail("NEXT_PUBLIC_SITE_URL must start with https:// in production");
  if (site.endsWith("/")) fail("NEXT_PUBLIC_SITE_URL must not end with a slash");
  if (/localhost|127\.0\.0\.1|vercel\.app$/.test(site)) warn(`NEXT_PUBLIC_SITE_URL is ${site} — use the real domain once it is connected`);
}
if (anon && service && anon === service) fail("The anon key and the service-role key are the same — the service-role key must be different");
if (anon && jwtRole(anon) && jwtRole(anon) !== "anon") fail(`NEXT_PUBLIC_SUPABASE_ANON_KEY has role "${jwtRole(anon)}" — use the anon/public key`);
if (service && jwtRole(service) && jwtRole(service) !== "service_role") fail("SUPABASE_SERVICE_ROLE_KEY is not a service-role key");
for (const name of Object.keys(env)) {
  if (name.startsWith("NEXT_PUBLIC_") && /SERVICE|SECRET|PASSWORD|SALT|HASH/.test(name)) fail(`${name} looks secret but would be sent to browsers (NEXT_PUBLIC_)`);
}
if (env.PAYMENTS_TEST_GATEWAY === "1") fail("PAYMENTS_TEST_GATEWAY=1 must not be set in production");
if ((env.PAYMENTS_GATEWAY_METHODS ?? "").trim()) {
  warn(`PAYMENTS_GATEWAY_METHODS=${env.PAYMENTS_GATEWAY_METHODS}: direct gateways are not implemented yet (docs/PAYMENTS.md) — leave it empty for manual EasyPaisa/JazzCash`);
} else ok("EasyPaisa / JazzCash run in manual mode (proposal §4)");

if (!url || !service) {
  console.log("\nCannot check the Supabase project without its URL and service-role key.");
  process.exit(1);
}

const headers = { apikey: service, Authorization: `Bearer ${service}` };
async function get(path, init = {}) {
  try {
    const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch (error) {
    return { status: 0, body: String(error) };
  }
}

section("Supabase database");
const settings = await get("/rest/v1/store_settings?id=eq.1&select=*");
if (settings.status === 0) {
  fail(`Cannot reach ${url} (${settings.body})`);
  process.exit(1);
}
if (settings.status !== 200 || !Array.isArray(settings.body) || settings.body.length !== 1) {
  fail(`store_settings not found (HTTP ${settings.status}) — run the migrations in supabase/migrations/ first`);
} else ok("store_settings row exists");

const tables = ["profiles", "products", "product_variants", "orders", "payments", "payment_attempts", "inventory_movements", "wishlist"];
for (const t of tables) {
  const r = await get(`/rest/v1/${t}?select=*&limit=0`);
  if (r.status === 401 || r.status === 403) {
    fail(`cannot read ${t} (HTTP ${r.status}) — check SUPABASE_SERVICE_ROLE_KEY`);
    break;
  }
  if (r.status !== 200) fail(`table ${t} missing (HTTP ${r.status}) — run the migrations`);
}
if (!failures) ok(`${tables.length} core tables present`);

// Functions from the migrations, read from PostgREST's OpenAPI description
// (never called: calling place_order would create an order).
const spec = await get("/rest/v1/");
const rpc = new Set(Object.keys(spec.body?.paths ?? {}).filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5)));
const expected = ["place_order", "submit_payment_evidence", "review_payment", "update_order_status", "adjust_stock", "admin_overview", "admin_customers", "admin_save_product", "admin_report"];
const missing = expected.filter((fn) => !rpc.has(fn));
if (rpc.size === 0) warn("could not read the API description to check functions");
else if (missing.length) fail(`functions missing: ${missing.join(", ")} — apply every file in supabase/migrations/ (latest: 20261129000011_admin_reports.sql)`);
else ok(`all ${expected.length} database functions present (migrations applied)`);

const admins = await get("/rest/v1/profiles?role=eq.admin&select=id");
if (Array.isArray(admins.body) && admins.body.length > 0) ok(`${admins.body.length} admin account(s)`);
else warn("no admin account yet — sign up on the site, then run the SQL in docs/DEPLOYMENT.md §5");

const products = await get("/rest/v1/products?is_active=eq.true&select=slug");
if (Array.isArray(products.body)) {
  const samples = products.body.filter((p) => /^(mens|womens)-|^leather-|^canvas-|^archived-/.test(p.slug)).length;
  if (products.body.length === 0) warn("no products in the shop yet");
  else ok(`${products.body.length} active products`);
  if (samples > 0) warn(`${samples} sample products from seed.sql are live — archive or replace them before launch`);
}

if (Array.isArray(settings.body) && settings.body[0]) {
  const s = settings.body[0];
  const real = (name, number) => name && number && !/placeholder/i.test(name) && !/x/i.test(number) && (number.match(/\d/g) ?? []).length >= 8;
  if (real(s.easypaisa_account_name, s.easypaisa_account_number)) ok("EasyPaisa account set");
  else warn("EasyPaisa account not set — EasyPaisa is hidden at checkout until Admin → Settings is filled in");
  if (real(s.jazzcash_account_name, s.jazzcash_account_number)) ok("JazzCash account set");
  else warn("JazzCash account not set — JazzCash is hidden at checkout until Admin → Settings is filled in");
  if (!s.whatsapp_number || s.whatsapp_number === "923000000000") warn("WhatsApp number is still the placeholder (Admin → Settings)");
  if (!s.support_email || /example\.com$/.test(s.support_email)) warn("support email is still the placeholder (Admin → Settings)");
}

section("Supabase storage");
const buckets = await get("/storage/v1/bucket");
if (!Array.isArray(buckets.body)) fail(`cannot list buckets (HTTP ${buckets.status})`);
else {
  const byId = Object.fromEntries(buckets.body.map((b) => [b.id, b]));
  if (byId["product-images"]?.public === true) ok("product-images bucket is public");
  else fail("product-images bucket missing or not public (migration 0004)");
  if (byId["payment-receipts"] && byId["payment-receipts"].public === false) ok("payment-receipts bucket is PRIVATE");
  else fail("payment-receipts bucket missing or public — receipts must be private (migration 0004)");
}

section("Supabase Auth");
const auth = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon || service } })
  .then((r) => r.json())
  .catch(() => null);
if (!auth) warn("could not read Auth settings");
else {
  if (auth.disable_signup) warn("sign-ups are disabled — customers cannot create accounts");
  else ok("customer sign-up enabled");
  if (auth.mailer_autoconfirm) warn("email confirmation is OFF — turn on 'Confirm email' (Authentication → Sign In / Providers → Email)");
  else ok("email confirmation on");
}

if (siteArg) {
  section(`Live site ${siteArg}`);
  const base = siteArg.replace(/\/+$/, "");
  try {
    const health = await fetch(`${base}/api/health`);
    if (health.ok) ok("/api/health responds");
    else fail(`/api/health returned ${health.status}`);
    const home = await fetch(base);
    const h = home.headers;
    if (h.get("content-security-policy")?.includes("frame-ancestors 'none'")) ok("security headers present");
    else fail("security headers missing");
    if (base.startsWith("https://") && !h.get("strict-transport-security")) warn("HSTS header missing — is NEXT_PUBLIC_SITE_URL set to the https domain?");
    const robots = await (await fetch(`${base}/robots.txt`)).text();
    if (robots.includes(`${base}/sitemap.xml`)) ok("robots.txt points at this domain's sitemap");
    else warn("robots.txt sitemap URL does not match --site (check NEXT_PUBLIC_SITE_URL)");
  } catch (error) {
    fail(`cannot reach ${base}: ${error}`);
  }
}

console.log(`\n${failures ? `✗ ${failures} problem(s) must be fixed` : "✓ No blocking problems"}${warnings ? `, ${warnings} warning(s) to review` : ""}.`);
process.exit(failures ? 1 : 0);
