import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/layout/InfoPage";
import { policies } from "@/config/policies";
import { getStoreSettings } from "@/lib/catalog/queries";

export const metadata: Metadata = { title: "Terms of service", description: "The terms that apply when you shop with us." };

export default async function TermsPage() {
  const s = await getStoreSettings();
  return (
    <InfoPage title="Terms of service" intro={`By placing an order with ${s.storeName} you agree to these terms.`}>
      {policies.terms.map((t) => (
        <InfoSection key={t.title} title={t.title}>
          <p>{t.body}</p>
        </InfoSection>
      ))}
      <InfoSection title="Delivery, exchanges & returns">
        <p>
          See{" "}
          <Link href="/shipping-returns" className="text-ink underline underline-offset-4">
            Shipping & returns
          </Link>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
