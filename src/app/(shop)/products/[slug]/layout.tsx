import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getProductBySlug } from "@/lib/catalog/queries";

/**
 * Existence check ABOVE this route's loading.tsx boundary, so an unknown or
 * inactive product returns a real HTTP 404 (not a streamed "soft 404").
 * The query is cached, so the page reuses the same result.
 */
export default async function ProductLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getProductBySlug(slug))) notFound();
  return children;
}
