import type { NextConfig } from "next";

const supabaseImages = (() => {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const local = u.hostname === "127.0.0.1" || u.hostname === "localhost";
    // Plain http only for the local development stack.
    if (u.protocol !== "https:" && !local) return null;
    return { protocol: u.protocol.replace(":", "") as "http" | "https", hostname: u.hostname, port: u.port, local };
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Product photos uploaded by the admin live in the public
    // `product-images` Supabase Storage bucket.
    remotePatterns: supabaseImages
      ? [{ protocol: supabaseImages.protocol, hostname: supabaseImages.hostname, port: supabaseImages.port, pathname: "/storage/v1/object/public/**" }]
      : [],
    // The local stack runs on 127.0.0.1, which the optimiser refuses by default.
    dangerouslyAllowLocalIP: supabaseImages?.local ?? false,
  },
  turbopack: {
    // Tailwind CSS v4 runs as a Turbopack loader (no PostCSS config needed).
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
