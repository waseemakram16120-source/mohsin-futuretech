import type { MetadataRoute } from "next";
import { getPublicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/checkout", "/cart", "/orders/", "/pay", "/api/", "/auth/", "/login", "/signup", "/forgot-password", "/reset-password", "/access-denied", "/payments/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
