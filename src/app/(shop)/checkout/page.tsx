import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { Breadcrumbs } from "@/components/listing/ListingPage";
import { enabledPaymentMethods } from "@/lib/payments/registry";

// Payment availability depends on server configuration at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container-page py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Bag", href: "/cart" }, { label: "Checkout" }]} />
      <h1 className="mt-6 mb-8 font-display text-4xl font-medium tracking-tight sm:text-5xl">Checkout</h1>
      <CheckoutForm methods={enabledPaymentMethods()} />
    </div>
  );
}
