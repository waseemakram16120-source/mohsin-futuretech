import type { Metadata } from "next";
import { ListingPage } from "@/components/listing/ListingPage";
import type { RawSearchParams } from "@/lib/catalog/filters";

export const metadata: Metadata = {
  title: "Sale",
  description: "Reduced prices on selected jackets, denim, shirts and accessories.",
  alternates: { canonical: "/sale" },
};

export default async function SalePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return (
    <ListingPage
      eyebrow="Limited time"
      title="Sale"
      description="Selected styles at reduced prices, while stocks last."
      crumbs={[{ label: "Home", href: "/" }, { label: "Sale" }]}
      scope={{ onSale: true }}
      searchParams={await searchParams}
      basePath="/sale"
      lockedSale
    />
  );
}
