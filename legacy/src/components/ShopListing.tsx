import { Suspense } from "react";
import Link from "next/link";
import ProductCard from "./ProductCard";
import ShopFilters from "./ShopFilters";
import {
  allColors,
  allSizes,
  applyFilters,
  parseShopFilters,
  type ShopFilters as ShopFiltersType,
} from "@/lib/data/catalog";
import type { StoreCategory } from "@/lib/data/categories";
import type { StoreProduct } from "@/lib/data/products";

/**
 * Shared listing used by /shop, /category/[slug] and /search:
 * filter sidebar (URL-driven) + result count + product grid.
 */
export default function ShopListing({
  title,
  description,
  breadcrumb,
  products,
  categories,
  rawParams,
  basePath,
  emptyMessage,
}: {
  title: string;
  description?: string;
  breadcrumb: { label: string; href?: string }[];
  products: StoreProduct[];
  categories: StoreCategory[];
  rawParams: Record<string, string | string[] | undefined>;
  basePath: string;
  emptyMessage: string;
}) {
  const filters: ShopFiltersType = parseShopFilters(rawParams);
  const filtered = applyFilters(products, filters);
  const prices = products.map((p) => p.price);
  const priceBounds = {
    min: prices.length ? Math.min(...prices) : 0,
    max: prices.length ? Math.max(...prices) : 0,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.label}>
            {i > 0 && " / "}
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-[#0f2440]">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-zinc-900">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <h1 className="mt-3 text-2xl font-bold text-zinc-900 sm:text-3xl">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-2xl leading-relaxed text-zinc-600">
          {description}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* useSearchParams() in ShopFilters needs a Suspense boundary
            during prerendering (Next.js 16). */}
        <Suspense
          fallback={
            <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
              Loading filters…
            </div>
          }
        >
          <ShopFilters
            categories={categories}
            sizes={allSizes(products)}
            colors={allColors(products)}
            filters={filters}
            priceBounds={priceBounds}
            basePath={basePath}
          />
        </Suspense>

        <div>
          <p className="text-sm text-zinc-600" aria-live="polite">
            Showing <span className="font-bold text-zinc-900">{filtered.length}</span>{" "}
            of {products.length} products
            {filters.q ? (
              <>
                {" "}
                for “<span className="font-semibold">{filters.q}</span>”
              </>
            ) : null}
          </p>

          {filtered.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-10 text-center">
              <p className="text-lg font-semibold text-zinc-900">
                No products match your filters
              </p>
              <p className="mt-2 text-sm text-zinc-600">{emptyMessage}</p>
              <Link
                href="/shop"
                className="mt-4 inline-block rounded-full bg-[#0f2440] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Browse all products
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
