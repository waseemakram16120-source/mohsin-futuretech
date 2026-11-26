import type { Metadata } from "next";
import { ListingPage } from "@/components/listing/ListingPage";
import type { RawSearchParams } from "@/lib/catalog/filters";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Shop every jacket, pair of jeans, shirt, trouser and accessory in one place.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return (
    <ListingPage
      title="Shop all"
      description="Every piece in the store — filter by size, colour and price to find your fit."
      crumbs={[{ label: "Home", href: "/" }, { label: "Shop all" }]}
      scope={{}}
      searchParams={await searchParams}
      basePath="/shop"
    />
  );
}
