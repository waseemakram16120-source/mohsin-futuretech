import { Suspense } from "react";
import type { Metadata } from "next";
import ShopListing from "@/components/ShopListing";
import { getCategories, searchProducts } from "@/lib/data/store";

export const metadata: Metadata = {
  title: "Search — Mohsin FutureTech",
  description: "Search jeans, jackets, shirts, trousers and accessories.",
};

type Params = Record<string, string | string[] | undefined>;

/**
 * Search results depend on the ?q= query param (request-time data), so
 * the listing renders inside a Suspense boundary (Next.js 16 Cache
 * Components).
 */
async function SearchContent({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const q =
    typeof params.q === "string"
      ? params.q
      : Array.isArray(params.q)
        ? (params.q[0] ?? "")
        : "";
  const [results, categories] = await Promise.all([
    searchProducts(q),
    getCategories(),
  ]);

  return (
    <ShopListing
      title={q ? `Results for “${q}”` : "Search Products"}
      description={
        q
          ? "Products matching your search. Use the filters to narrow them down."
          : "Type a product name, category or keyword in the search box above."
      }
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Shop", href: "/shop" },
        { label: "Search" },
      ]}
      products={results}
      categories={categories}
      rawParams={params}
      basePath="/search"
      emptyMessage="No products matched your search. Try a different keyword — for example “jeans”, “jacket” or “shirt”."
    />
  );
}

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="text-zinc-600">Searching…</p>
        </div>
      }
    >
      <SearchContent searchParams={searchParams} />
    </Suspense>
  );
}
