import type { Metadata } from "next";
import { AdminInbox } from "@/components/admin/AdminInbox";
import { AdminPageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Messages" };

type Props = { searchParams: Promise<{ c?: string }> };

export default async function AdminMessagesPage({ searchParams }: Props) {
  await requireAdmin("/admin/messages");
  const { c } = await searchParams;
  const initial = typeof c === "string" && /^[0-9a-f-]{36}$/i.test(c) ? c : null;
  return (
    <div>
      <AdminPageHeader title="Messages" description="Live chat with customers. New messages appear automatically; keep this page open while you're available." />
      <AdminInbox initialId={initial} />
    </div>
  );
}
