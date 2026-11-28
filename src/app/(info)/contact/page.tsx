import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/layout/InfoPage";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, WhatsAppIcon } from "@/components/ui/Icon";
import { policies } from "@/config/policies";
import { getStoreSettings } from "@/lib/catalog/queries";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contact us",
  description: "WhatsApp, phone, email and shop address.",
};

export default async function ContactPage() {
  const s = await getStoreSettings();
  const wa = whatsappLink(s.whatsapp, `Hi ${s.storeName}, I have a question.`);
  return (
    <InfoPage title="Contact us" intro="The fastest way to reach us is WhatsApp. Please include your order number if you have one.">
      {wa ? (
        <ButtonLink href={wa} target="_blank" rel="noopener noreferrer" size="lg" className="w-full sm:w-auto">
          <WhatsAppIcon className="size-5" /> Chat on WhatsApp
        </ButtonLink>
      ) : null}
      <InfoSection title="Other ways to reach us">
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <Icon name="phone" className="size-4 shrink-0" />
            <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="text-ink underline underline-offset-4">
              {s.phone}
            </a>
          </li>
          <li className="flex items-center gap-3">
            <Icon name="mail" className="size-4 shrink-0" />
            <a href={`mailto:${s.email}`} className="text-ink underline underline-offset-4">
              {s.email}
            </a>
          </li>
          <li className="flex items-start gap-3">
            <Icon name="pin" className="mt-1 size-4 shrink-0" />
            <address className="not-italic">{s.address}</address>
          </li>
        </ul>
        <p>Hours: {policies.businessHours}.</p>
      </InfoSection>
      <InfoSection title="About an order?">
        <p>
          You can check its status yourself on{" "}
          <Link href="/track" className="text-ink underline underline-offset-4">
            Track your order
          </Link>{" "}
          or in{" "}
          <Link href="/account/orders" className="text-ink underline underline-offset-4">
            My orders
          </Link>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
