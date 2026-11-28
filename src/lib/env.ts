import { z } from "@/lib/z";

/**
 * Environment variable validation.
 *
 * Public values (NEXT_PUBLIC_*) are inlined into the browser bundle at build
 * time, so they must be read with literal `process.env.NEXT_PUBLIC_X` access.
 * The service-role key is read only by src/lib/supabase/admin.ts, which is
 * marked "server-only".
 */

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_URL is missing" })
    .url("NEXT_PUBLIC_SUPABASE_URL must be a URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing" })
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY looks too short"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `- ${i.message}`).join("\n");
    throw new Error(
      `Invalid public environment variables. Copy .env.example to .env.local and fill it in.\n${issues}`,
    );
  }
  return result.data;
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
}

/** True when the Supabase URL and anon key are present (does not validate). */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
