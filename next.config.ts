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

const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();
const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy without nonces, so catalogue pages stay static
 * and cached (a nonce would force every page to render per request).
 * Next.js needs inline scripts/styles; everything else is locked down:
 * no framing, no plugins, no foreign base/form targets, and network calls
 * only to this site and Supabase. When a direct payment gateway that posts
 * a form to the provider is enabled, add its host to form-action.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabaseOrigin}`.trim(),
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
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
