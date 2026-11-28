import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminOrderTable, AdminPageHeader, adminDate } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { requireAdmin } from "@/lib/admin/auth";
import { getCustomer } from "@/lib/admin/catalog";
import { formatPkPhone } from "@/lib/checkout/phone";
import { formatPrice } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import type { AdminOrderRow } from "@/lib/admin/orders";

export const metadata: Metadata = { title: "Customer" };

type Props = { params: Promise<{ id: string }> };

export default async function AdminCustomerPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin(`/admin/customers/${id}`);
  const data = await getCustomer(id);
  if (!data) notFound();
  const { profile, addresses, orders } = data;
  const spent = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned").reduce((n, o) => n + o.total_amount, 0);
  const wa = profile.phone ? whatsappLink(`92${profile.phone.slice(1)}`, `Hi ${profile.full_name || ""}`.trim()) : null;
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm">
          <Link href="/admin/customers" className="underline underline-offset-4">
            ← All customers
          </Link>
        </p>
        <AdminPageHeader
          title={profile.full_name || profile.email}
          description={`Joined ${adminDate.format(new Date(profile.created_at))} · ${orders.length} order${orders.length === 1 ? "" : "s"} · ${formatPrice(spent)} spent`}
          actions={profile.role === "admin" ? <Badge tone="dark">Admin</Badge> : undefined}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-card border border-stone bg-surface p-5" aria-label="Contact">
          <h2 className="font-display text-xl">Contact</h2>
          <p className="mt-3 text-sm">
            <a href={`mailto:${profile.email}`} className="underline underline-offset-4">
              {profile.email}
            </a>
          </p>
          {profile.phone ? (
            <p className="text-sm">
              <a href={`tel:${profile.phone}`} className="underline underline-offset-4">
                {formatPkPhone(profile.phone)}
              </a>
              {wa ? (
                <>
                  {" · "}
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    WhatsApp
                  </a>
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-ink-soft">No phone on profile</p>
          )}
        </section>
        <section className="rounded-card border border-stone bg-surface p-5" aria-label="Saved addresses">
          <h2 className="font-display text-xl">Saved addresses</h2>
          {addresses.length ? (
            <ul className="mt-3 space-y-3 text-sm">
              {addresses.map((a) => (
                <li key={a.id}>
                  <p className="font-medium">
                    {a.label} {a.is_default ? <Badge tone="dark">Default</Badge> : null}
                  </p>
                  <p className="text-ink-soft">
                    {a.full_name} · {formatPkPhone(a.phone)} · {a.address_line1}
                    {a.address_line2 ? `, ${a.address_line2}` : ""}, {a.city}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">None saved.</p>
          )}
        </section>
      </div>
      <section aria-labelledby="c-orders">
        <h2 id="c-orders" className="mb-4 font-display text-2xl">
          Order history
        </h2>
        {orders.length ? <AdminOrderTable rows={orders as AdminOrderRow[]} /> : <EmptyState icon="bag" title="No orders yet" />}
      </section>
    </div>
  );
}
