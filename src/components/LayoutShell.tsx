/**
 * Layout shell (client component).
 *
 * The storefront header/footer are shown everywhere EXCEPT under /admin,
 * where the admin layout provides its own sidebar + top bar. Uses the
 * client-side pathname so no server middleware is needed.
 *
 * `usePathname()` is only available at runtime, so the pathname-dependent
 * part is wrapped in <Suspense> — during prerendering the storefront
 * chrome is shown as the fallback, then the real chrome streams in.
 */
"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import type { StoreCategory } from "@/lib/data/categories";

function Chrome({
  categories,
  children,
}: {
  categories: StoreCategory[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdmin) {
    return <div className="flex-1">{children}</div>;
  }

  return (
    <>
      <SiteHeader categories={categories} />
      <div className="flex-1">{children}</div>
      <SiteFooter categories={categories} />
    </>
  );
}

export default function LayoutShell({
  categories,
  children,
}: {
  categories: StoreCategory[];
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader categories={categories} />
          <div className="flex-1">{children}</div>
          <SiteFooter categories={categories} />
        </>
      }
    >
      <Chrome categories={categories}>{children}</Chrome>
    </Suspense>
  );
}
