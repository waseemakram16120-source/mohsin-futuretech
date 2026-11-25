import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import ProductDetail from "@/components/ProductDetail";
import { getProductBySlug, getProductsByCategory } from "@/lib/data/store";
import { LOCAL_PRODUCTS } from "@/lib/data/products";

export async function generateStaticParams() {
  return LOCAL_PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found — Mohsin FutureTech" };
  return {
    title: `${product.name} — Mohsin FutureTech`,
    description: product.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = (await getProductsByCategory(product.categorySlug))
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <ProductDetail product={product} />

      {related.length > 0 && (
        <section className="mt-14">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-bold text-zinc-900">
              Related Products
            </h2>
            <Link
              href={`/category/${product.categorySlug}`}
              className="shrink-0 text-sm font-semibold text-[#0f2440] hover:underline"
            >
              More {product.categoryName} →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
