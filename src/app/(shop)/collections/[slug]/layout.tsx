import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { resolveCollection } from "./collection";

/** Real HTTP 404 for unknown collections (runs above loading.tsx). */
export default async function CollectionLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await resolveCollection(slug))) notFound();
  return children;
}
