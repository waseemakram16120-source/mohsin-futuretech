import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents is OFF on purpose: the store reads live Supabase data
  // on every render through the cookie-based server client (see
  // src/lib/supabase/server.ts, used by src/lib/data/store.ts from the
  // root layout and the shop/product/category/search pages). With
  // cacheComponents on, `next build` fails with "uncached or runtime data
  // during prerendering" as soon as the Supabase env vars are set
  // (Vercel redeploy failure 2026-11-24). In classic mode, accessing
  // cookies() opts each route into dynamic rendering automatically, and
  // `export const dynamic = "force-dynamic"` in src/app/layout.tsx makes
  // it explicit so prices/stock are always live. Revisit only if the app
  // is deliberately migrated to Cache Components with Suspense boundaries
  // around every dynamic read.
  cacheComponents: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-*" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
