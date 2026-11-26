/**
 * Client-safe Supabase checks (Step 3).
 *
 * src/lib/data/store.ts is server-only ("server-only") and cannot be
 * imported by client components — this tiny module is the client-safe
 * equivalent for the one check client code needs.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return (
    url.length > 0 &&
    !url.includes("placeholder") &&
    !url.includes("your-project-ref") &&
    key.length > 0 &&
    !key.includes("placeholder") &&
    !key.includes("your-anon-public-key")
  );
}
