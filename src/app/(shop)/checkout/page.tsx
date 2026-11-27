import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { Breadcrumbs } from "@/components/listing/ListingPage";
import { isGatewayMethod, type GatewayMethod } from "@/config/store";
import { getStoreSettings } from "@/lib/catalog/queries";
import { checkoutPaymentMethods, walletMode } from "@/lib/payments/registry";

// Payment availability depends on server configuration and live settings.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const settings = await getStoreSettings({ live: true });
  const methods = checkoutPaymentMethods(settings);
  const manualMethods = methods.filter((m): m is GatewayMethod => isGatewayMethod(m) && walletMode(m) === "manual");
  return (
    <div className="container-page py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Bag", href: "/cart" }, { label: "Checkout" }]} />
      <h1 className="mt-6 mb-8 font-display text-4xl font-medium tracking-tight sm:text-5xl">Checkout</h1>
      <CheckoutForm methods={methods} manualMethods={manualMethods} />
    </div>
  );
}
