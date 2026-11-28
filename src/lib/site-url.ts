/** The public site URL (no trailing slash). Needs no Supabase settings. */
export function siteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").trim();
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}
