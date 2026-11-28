/**
 * Where to send the browser after sign-in / sign-up / email links.
 * Only paths on THIS site are allowed, so `?next=https://evil.example`,
 * `//evil.example` or `/\evil.example` can never become an open redirect.
 */
const BLOCKED_PREFIXES = ["/auth/", "/api/", "/login", "/signup", "/forgot-password"];

export function safeNext(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(v)) return fallback;
  if (v.length > 300) return fallback;
  try {
    // Parsing against a dummy origin must keep us on that origin.
    const u = new URL(v, "http://local.invalid");
    if (u.origin !== "http://local.invalid") return fallback;
    const path = `${u.pathname}${u.search}${u.hash}`;
    if (BLOCKED_PREFIXES.some((p) => u.pathname === p.replace(/\/$/, "") || u.pathname.startsWith(p))) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
