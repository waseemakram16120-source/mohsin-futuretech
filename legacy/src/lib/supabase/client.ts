import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser (client-component) Supabase client.
 *
 * Uses the public anon key only — Row Level Security (supabase/policies.sql)
 * decides what a signed-in customer can see or change. Never put the
 * service-role key in browser code.
 *
 * The placeholder values keep `next build` green before .env.local exists;
 * real values come from .env.local (see .env.example). Any real query will
 * fail until the project URL / anon key are set.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
  );
}
