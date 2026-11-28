import Link from "next/link";
import type { ReactNode } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/States";
import {
  clearFilters,
  filtersToSearch,
  hasActiveFilters,
  pageList,
  parseFilters,
  type ListingFilters,
  type RawSearchParams,
  type SortValue,
} from "@/lib/catalog/filters";
import { getFacets, getListing, type ListingScope } from "@/lib/catalog/queries";
import { cn } from "@/lib/cn";
import {
  ActiveFilterChips,
  FilterPanel,
  ListingProvider,
  MobileFilterSheet,
  ResultsRegion,
  SortSelect,
} from "./ListingControls";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 ? <Icon name="chevronRight" className="size-3" /> : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-ink hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink-soft">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Pagination({
  basePath,
  filters,
  pageCount,
  defaultSort,
}: {
  basePath: string;
  filters: ListingFilters;
  pageCount: number;
  defaultSort: SortValue;
}) {
  if (pageCount <= 1) return null;
  const href = (page: number) => `${basePath}${filtersToSearch({ ...filters, page }, defaultSort)}`;
  const linkCls = "inline-flex size-11 items-center justify-center rounded-xs text-sm font-medium";
  return (
    <nav aria-label="Pagination" className="mt-14 flex items-center justify-center gap-1">
      {filters.page > 1 ? (
        <Link href={href(filters.page - 1)} className={cn(linkCls, "hover:bg-sand")} aria-label="Previous page">
          <Icon name="chevronRight" className="size-4 rotate-180" />
        </Link>
      ) : null}
      {pageList(filters.page, pageCount).map((page, i) =>
        page === null ? (
          <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={page}
            href={href(page)}
            aria-current={page === filters.page ? "page" : undefined}
            aria-label={`Page ${page}`}
            className={cn(linkCls, page === filters.page ? "bg-ink text-surface" : "hover:bg-sand")}
          >
            {page}
          </Link>
        ),
      )}
      {filters.page < pageCount ? (
        <Link href={href(filters.page + 1)} className={cn(linkCls, "hover:bg-sand")} aria-label="Next page">
          <Icon name="chevronRight" className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}

/**
 * Shared listing layout for /shop, /collections/*, /new-arrivals, /sale and
 * /search. Filters come from the URL; results and filter options come from
 * catalog_search / catalog_facets.
 */
export async function ListingPage({
  eyebrow,
  title,
  description,
  crumbs,
  scope,
  searchParams,
  basePath,
  defaultSort = "featured",
  lockedSale = false,
  header,
}: {
  eyebrow?: string;
  title: string;
  description?: string | null;
  crumbs: Crumb[];
  scope: ListingScope;
  searchParams: RawSearchParams;
  basePath: string;
  defaultSort?: SortValue;
  lockedSale?: boolean;
  header?: ReactNode;
}) {
  const filters = parseFilters(searchParams, defaultSort);
  const [listing, facets] = await Promise.all([getListing(scope, filters), getFacets(scope, filters.q)]);
  const allowRelevance = Boolean(filters.q);
  // On /sale the sale flag is implied, so it does not count as a filter.
  const filtered = hasActiveFilters(lockedSale ? { ...filters, onSale: false } : filters);
  const clearHref = `${basePath}${filtersToSearch(clearFilters(filters), defaultSort)}`;

  return (
    <ListingProvider filters={filters} defaultSort={defaultSort}>
      <div className="border-b border-stone bg-surface">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={crumbs} />
          {eyebrow ? <p className="eyebrow mt-6 text-accent">{eyebrow}</p> : null}
          <h1 className={cn("font-display text-4xl font-medium tracking-tight sm:text-5xl", eyebrow ? "mt-2" : "mt-6")}>
            {title}
          </h1>
          {description ? <p className="mt-3 max-w-2xl text-ink-soft">{description}</p> : null}
          {header}
        </div>
      </div>

      <div className="container-page py-8 lg:grid lg:grid-cols-[15rem_1fr] lg:gap-10 lg:py-10 xl:grid-cols-[16.5rem_1fr]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-24">
            <h2 className="mb-5 text-sm font-semibold tracking-[0.08em] uppercase">Filters</h2>
            <FilterPanel facets={facets} lockedSale={lockedSale} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft" aria-live="polite" data-testid="result-count">
              {listing.total} {listing.total === 1 ? "product" : "products"}
            </p>
            <div className="flex items-center gap-2">
              <MobileFilterSheet facets={facets} total={listing.total} lockedSale={lockedSale} allowRelevance={allowRelevance} />
              <div className="hidden lg:block">
                <SortSelect allowRelevance={allowRelevance} />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <ActiveFilterChips lockedSale={lockedSale} />
          </div>

          <ResultsRegion>
            {listing.products.length > 0 ? (
              <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 xl:grid-cols-4" data-testid="product-grid">
                {listing.products.map((product, i) => (
                  <li key={product.id}>
                    <ProductCard product={product} priority={i < 4} headingLevel={2} sizes="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 50vw" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6">
                <EmptyState
                  icon="search"
                  title={filtered ? "No products match these filters" : "Nothing here yet"}
                  description={
                    filtered
                      ? "Try removing a filter or widening the price range."
                      : "New pieces are added regularly — check back soon or explore another collection."
                  }
                  action={
                    filtered ? (
                      <ButtonLink href={clearHref}>Clear filters</ButtonLink>
                    ) : (
                      <ButtonLink href="/shop">Shop all products</ButtonLink>
                    )
                  }
                />
              </div>
            )}
            <Pagination basePath={basePath} filters={filters} pageCount={listing.pageCount} defaultSort={defaultSort} />
          </ResultsRegion>
        </div>
      </div>
    </ListingProvider>
  );
}

/** Skeleton used by the listing routes' loading.tsx. */
export function ListingSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading products…</span>
      <div className="border-b border-stone bg-surface">
        <div className="container-page space-y-4 py-10">
          <div className="h-3 w-32 animate-pulse rounded-xs bg-sand" />
          <div className="h-12 w-64 animate-pulse rounded-xs bg-sand" />
        </div>
      </div>
      <div className="container-page grid grid-cols-2 gap-x-3 gap-y-8 py-10 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <div className="aspect-[3/4] animate-pulse rounded-card bg-sand" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded-xs bg-sand" />
            <div className="mt-2 h-4 w-1/3 animate-pulse rounded-xs bg-sand" />
          </div>
        ))}
      </div>
    </div>
  );
}
