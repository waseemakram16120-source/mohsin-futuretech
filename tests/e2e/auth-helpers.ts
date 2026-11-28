import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

let env: Record<string, string> | null = null;
/** URL and keys of the LOCAL Supabase stack (never a real project). */
export function localSupabase() {
  if (env) return env;
  const out = execSync("npx --no-install supabase status -o env", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    env: { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: "docker.io" },
  });
  env = Object.fromEntries(
    out
      .split("\n")
      .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  return env;
}

export const PASSWORD = "Shop2026pass";

export function uniqueEmail(tag = "user") {
  return `${tag}-${randomUUID().slice(0, 12)}@example.com`;
}

/** Create a confirmed customer directly (fast; sign-up UI has its own test). */
export async function createCustomer(opts: { name?: string; email?: string; password?: string } = {}) {
  const { API_URL, SERVICE_ROLE_KEY } = localSupabase();
  const email = opts.email ?? uniqueEmail();
  const res = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: opts.password ?? PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: opts.name ?? "Sana Malik" },
    }),
  });
  if (!res.ok) throw new Error(`createCustomer failed: ${res.status} ${await res.text()}`);
  const user = (await res.json()) as { id: string };
  return { id: user.id, email, password: opts.password ?? PASSWORD };
}

export async function signIn(page: Page, email: string, password = PASSWORD, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Latest email to `to` in the local Mailpit inbox. */
export async function latestEmail(to: string, timeoutMs = 15_000): Promise<{ subject: string; html: string }> {
  const { MAILPIT_URL } = localSupabase();
  const base = MAILPIT_URL ?? "http://127.0.0.1:54324";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (search.ok) {
      const body = (await search.json()) as { messages?: Array<{ ID: string; Subject: string }> };
      const first = body.messages?.[0];
      if (first) {
        const msg = (await (await fetch(`${base}/api/v1/message/${first.ID}`)).json()) as { HTML: string; Subject: string };
        return { subject: msg.Subject, html: msg.HTML };
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email for ${to}`);
}
