import type { Metadata } from "next";
import Link from "next/link";
import { ListingPage } from "@/components/listing/ListingPage";
import { Icon } from "@/components/ui/Icon";
import type { RawSearchParams } from "@/lib/catalog/filters";
import { getCategories } from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

function SearchBox({ q }: { q: string }) {
  return (
    <form action="/search" role="search" className="mt-6 max-w-xl">
      <label htmlFor="search-q" className="sr-only">
        Search products
      </label>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
        <input
          id="search-q"
          name="q"
          type="search"
          defaultValue={q}
          autoComplete="off"
          maxLength={100}
          placeholder="Search jackets, jeans, shirts…"
          className="h-13 w-full rounded-xs border border-stone-strong bg-paper pr-28 pl-12 text-base placeholder:text-muted"
        />
        <button
          type="submit"
          className="absolute top-1.5 right-1.5 h-10 rounded-xs bg-ink px-5 text-sm font-medium text-surface hover:bg-accent-strong"
        >
          Search
        </button>
      </div>
    </form>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").trim().slice(0, 100);

  if (!q) {
    const categories = await getCategories();
    return (
      <div className="border-b border-stone bg-surface">
        <div className="container-page py-10 sm:py-14">
          <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">Search</h1>
          <SearchBox q="" />
          <p className="mt-8 text-sm font-semibold">Popular categories</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {[{ name: "Men", slug: "men" }, { name: "Women", slug: "women" }, ...categories].map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/collections/${c.slug}`}
                  className="inline-flex h-10 items-center rounded-full border border-stone-strong px-4 text-sm hover:border-ink"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <ListingPage
      title={`Results for “${q}”`}
      crumbs={[{ label: "Home", href: "/" }, { label: "Search" }]}
      scope={{}}
      searchParams={params}
      basePath="/search"
      defaultSort="relevance"
      header={<SearchBox q={q} />}
    />
  );
}
