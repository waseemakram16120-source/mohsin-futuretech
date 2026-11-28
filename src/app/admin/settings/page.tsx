import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { AdminPageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getRawSettings } from "@/lib/admin/catalog";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireAdmin("/admin/settings");
  const settings = await getRawSettings();
  return (
    <div>
      <AdminPageHeader title="Settings" description="Contact details, delivery charges and payment accounts shown in the shop." />
      <SettingsForm settings={settings} />
    </div>
  );
}
