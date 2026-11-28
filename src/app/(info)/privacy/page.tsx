import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/layout/InfoPage";
import { policies } from "@/config/policies";
import { getStoreSettings } from "@/lib/catalog/queries";

export const metadata: Metadata = { title: "Privacy policy", description: "What information we collect and how we use it." };

export default async function PrivacyPage() {
  const s = await getStoreSettings();
  return (
    <InfoPage title="Privacy policy" intro={`How ${s.storeName} handles your personal information.`}>
      {policies.privacy.map((p) => (
        <InfoSection key={p.title} title={p.title}>
          <p>{p.body}</p>
        </InfoSection>
      ))}
      <InfoSection title="Contact">
        <p>
          Questions about your data: <a href={`mailto:${s.email}`} className="text-ink underline underline-offset-4">{s.email}</a>
        </p>
      </InfoSection>
    </InfoPage>
  );
}
