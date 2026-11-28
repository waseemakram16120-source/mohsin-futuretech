import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

/** Public pages only: catalogue and info pages (never account, checkout or admin). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const fixed = ["/", "/shop", "/new-arrivals", "/sale", "/collections/men", "/collections/women", "/size-guide", "/shipping-returns", "/contact", "/track", "/privacy", "/terms"];
  const entries: MetadataRoute.Sitemap = fixed.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" || path === "/new-arrivals" || path === "/sale" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.6,
  }));
  try {
    const db = createPublicClient();
    const [{ data: categories }, { data: products }] = await Promise.all([
      db.from("categories").select("slug, updated_at"),
      db.from("products").select("slug, updated_at").limit(5000),
    ]);
    for (const c of categories ?? []) entries.push({ url: `${base}/collections/${c.slug}`, lastModified: c.updated_at, changeFrequency: "weekly", priority: 0.7 });
    for (const p of products ?? []) entries.push({ url: `${base}/products/${p.slug}`, lastModified: p.updated_at, changeFrequency: "weekly", priority: 0.8 });
  } catch (error) {
    console.error("[sitemap] catalogue unavailable", error);
  }
  return entries;
}
