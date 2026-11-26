import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingPage } from "@/components/listing/ListingPage";
import type { RawSearchParams } from "@/lib/catalog/filters";
import { resolveCollection } from "./collection";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const collection = await resolveCollection(slug);
  if (!collection) return { title: "Collection not found" };
  return {
    title: collection.title,
    description: collection.description ?? undefined,
    alternates: { canonical: `/collections/${slug}` },
  };
}

export default async function CollectionPage({ params, searchParams }: Params & { searchParams: Promise<RawSearchParams> }) {
  const { slug } = await params;
  const collection = await resolveCollection(slug);
  if (!collection) notFound();
  return (
    <ListingPage
      eyebrow={collection.eyebrow}
      title={collection.title}
      description={collection.description}
      crumbs={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: collection.title }]}
      scope={collection.scope}
      searchParams={await searchParams}
      basePath={`/collections/${slug}`}
    />
  );
}
