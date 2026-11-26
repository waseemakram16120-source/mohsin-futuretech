import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ShopListing from "@/components/ShopListing";
import { getCategories, getProductsByCategory } from "@/lib/data/store";
import { LOCAL_CATEGORIES } from "@/lib/data/categories";

export async function generateStaticParams() {
  return LOCAL_CATEGORIES.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = LOCAL_CATEGORIES.find((c) => c.slug === slug);
  return {
    title: category
      ? `${category.name} — Mohsin FutureTech`
      : "Category — Mohsin FutureTech",
    description: category?.description ?? "Browse products by category.",
  };
}

type Params = Record<string, string | string[] | undefined>;

/**
 * The listing reads URL search params (filters / sorting), which is
 * request-time data — so it renders inside a Suspense boundary and the
 * page shell can still be prerendered (Next.js 16 Cache Components).
 */
async function CategoryContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Params>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const [products, categories] = await Promise.all([
    getProductsByCategory(slug),
    getCategories(),
  ]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  return (
    <ShopListing
      title={category.name}
      description={category.description}
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Shop", href: "/shop" },
        { label: category.name },
      ]}
      products={products}
      categories={categories}
      rawParams={query}
      basePath={`/category/${slug}`}
      emptyMessage="No products in this category match the current filters — try clearing them."
    />
  );
}

export default function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
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
      <CategoryContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
