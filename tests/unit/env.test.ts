import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "@/lib/env";

describe("parsePublicEnv", () => {
  const valid = {
    NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "x".repeat(40),
  };

  it("accepts a valid configuration and defaults the site URL", () => {
    expect(parsePublicEnv(valid)).toEqual({ ...valid, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" });
  });

  it("explains what is missing", () => {
    expect(() => parsePublicEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL is missing/);
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(/must be a URL/);
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: "short" })).toThrow(/too short/);
  });
});
