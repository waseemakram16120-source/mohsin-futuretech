import type { Metadata } from "next";
import { ListingPage } from "@/components/listing/ListingPage";
import type { RawSearchParams } from "@/lib/catalog/filters";

export const metadata: Metadata = {
  title: "New arrivals",
  description: "The latest jackets, denim, shirts and accessories, just landed.",
  alternates: { canonical: "/new-arrivals" },
};

export default async function NewArrivalsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return (
    <ListingPage
      eyebrow="Just landed"
      title="New arrivals"
      description="Fresh pieces for the season, added every week."
      crumbs={[{ label: "Home", href: "/" }, { label: "New arrivals" }]}
      scope={{ newOnly: true }}
      searchParams={await searchParams}
      basePath="/new-arrivals"
      defaultSort="newest"
    />
  );
}
