import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { Breadcrumbs } from "@/components/listing/ListingPage";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-page py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Bag" }]} />
      <h1 className="mt-6 mb-8 font-display text-4xl font-medium tracking-tight sm:text-5xl">Your bag</h1>
      <CartView />
    </div>
  );
}
