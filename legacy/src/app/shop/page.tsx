import { Suspense } from "react";
import type { Metadata } from "next";
import ShopListing from "@/components/ShopListing";
import { getCategories, getProducts } from "@/lib/data/store";

export const metadata: Metadata = {
  title: "Shop All Products — Mohsin FutureTech",
  description:
    "Browse all fashion products — jeans, jackets, shirts, trousers and accessories. Search, filter and sort.",
};

type Params = Record<string, string | string[] | undefined>;

/**
 * The listing reads URL search params (filters / sorting), which is
 * request-time data — so it renders inside a Suspense boundary and the
 * page shell can still be prerendered (Next.js 16 Cache Components).
 */
async function ShopContent({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  return (
    <ShopListing
      title="Shop All Products"
      description="Browse the full collection — search, filter by category, price, size or colour, and sort the way you like."
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Shop" }]}
      products={products}
      categories={categories}
      rawParams={params}
      basePath="/shop"
      emptyMessage="Try a different search term or clear the filters to see the full collection."
    />
  );
}

export default function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="text-zinc-600">Loading products…</p>
        </div>
      }
    >
      <ShopContent searchParams={searchParams} />
    </Suspense>
  );
}
