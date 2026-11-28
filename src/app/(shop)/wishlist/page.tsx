import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/listing/ListingPage";
import { WishlistView } from "@/components/wishlist/WishlistView";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function WishlistPage() {
  return (
    <>
      <div className="border-b border-stone bg-surface">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Wishlist" }]} />
          <h1 className="mt-6 font-display text-4xl font-medium tracking-tight sm:text-5xl">Wishlist</h1>
          <p className="mt-3 text-ink-soft">Saved on this device. Sign-in sync arrives with customer accounts.</p>
        </div>
      </div>
      <div className="container-page py-8 sm:py-10">
        <WishlistView />
      </div>
    </>
  );
}
