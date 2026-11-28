import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/checkout", "/cart", "/orders/", "/pay", "/api/", "/auth/", "/login", "/signup", "/forgot-password", "/reset-password", "/access-denied", "/payments/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
