import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/layout/InfoPage";
import { policies } from "@/config/policies";
import { storeConfig } from "@/config/store";
import { getStoreSettings } from "@/lib/catalog/queries";
import { formatPrice } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Shipping & returns",
  description: "Delivery charges, delivery times and how exchanges and returns work.",
};

export default async function ShippingReturnsPage() {
  const s = await getStoreSettings();
  const wa = whatsappLink(s.whatsapp, "Hi, I'd like to exchange or return an item from order ");
  return (
    <InfoPage title="Shipping & returns" intro={`Delivery across Pakistan in ${storeConfig.delivery.estimate}.`}>
      <InfoSection title="Delivery charges">
        <table className="w-full max-w-md text-sm">
          <tbody className="divide-y divide-stone">
            <tr>
              <th scope="row" className="py-2 text-left font-medium text-ink">Orders under {formatPrice(s.freeDeliveryMin)}</th>
              <td className="py-2 text-right tabular-nums">{formatPrice(s.deliveryCharge)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-2 text-left font-medium text-ink">Orders of {formatPrice(s.freeDeliveryMin)} or more</th>
              <td className="py-2 text-right font-semibold text-success">Free</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm">The free-delivery amount is counted after any coupon discount.</p>
      </InfoSection>
      <InfoSection title="Delivery">
        <ul className="list-disc space-y-2 pl-5">
          {policies.shipping.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>
          You can follow your order any time on{" "}
          <Link href="/track" className="text-ink underline underline-offset-4">
            Track your order
          </Link>
          .
        </p>
      </InfoSection>
      <InfoSection title="Exchanges & returns">
        <ul className="list-disc space-y-2 pl-5">
          {policies.returns.map((line) => (
            <li key={line}>{line.replace("{days}", String(policies.returnDays))}</li>
          ))}
        </ul>
        {wa ? (
          <p>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-4">
              Start an exchange on WhatsApp
            </a>
          </p>
        ) : null}
      </InfoSection>
    </InfoPage>
  );
}
