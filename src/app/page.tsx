import {
  AudienceSplit,
  CategoryTiles,
  Hero,
  ProductGrid,
  ProductRail,
  SaleBanner,
  TrustStrip,
} from "@/components/home/sections";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { countProducts, getCategories, getProductCards, getStoreSettings } from "@/lib/catalog/queries";
import { discountPercent, fullRows } from "@/lib/format";

export const revalidate = 60;

export default async function HomePage() {
  const [settings, categories, featured, newArrivals, sale, menCount, womenCount, menPick, womenPick] =
    await Promise.all([
      getStoreSettings(),
      getCategories(),
      getProductCards({ featured: true, limit: 8 }),
      getProductCards({ newArrivals: true, limit: 8 }),
      getProductCards({ onSale: true, limit: 8 }),
      countProducts("men"),
      countProducts("women"),
      getProductCards({ audience: "men", featured: true, limit: 1 }),
      getProductCards({ audience: "women", featured: true, limit: 1 }),
    ]);

  const hasProducts = featured.length + newArrivals.length + sale.length > 0;
  const maxDiscount = Math.max(0, ...sale.map((p) => discountPercent(p.price, p.compareAtPrice)));
  const heroImages = featured.filter((p) => p.image && p.inStock).slice(0, 2);

  return (
    <>
      <Hero freeDeliveryMin={settings.freeDeliveryMin} images={heroImages} />
      <TrustStrip freeDeliveryMin={settings.freeDeliveryMin} />

      {hasProducts ? (
        <>
          <CategoryTiles categories={categories} />
          <ProductRail
            id="new-title"
            eyebrow="Just landed"
            title="New arrivals"
            href="/new-arrivals"
            products={fullRows(newArrivals, 4)}
          />
          <AudienceSplit
            panels={[
              { key: "men", title: "Men", count: menCount, product: menPick[0] ?? null },
              { key: "women", title: "Women", count: womenCount, product: womenPick[0] ?? null },
            ]}
          />
          <ProductGrid id="featured-title" eyebrow="Editor's edit" title="Featured pieces" href="/shop" products={fullRows(featured, 4)} />
          <SaleBanner maxDiscount={maxDiscount} />
          <ProductRail id="sale-products-title" eyebrow="On sale" title="Last chance to buy" href="/sale" products={fullRows(sale, 4)} />
        </>
      ) : (
        <div className="container-page mt-16">
          <EmptyState
            title="Our new collection is on its way"
            description="We're photographing the latest pieces. Message us on WhatsApp to hear first when they land."
            action={<ButtonLink href="/contact">Contact us</ButtonLink>}
          />
        </div>
      )}
    </>
  );
}
