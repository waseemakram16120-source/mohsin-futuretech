import type { Metadata } from "next";
import Link from "next/link";
import { OrderList } from "@/components/account/OrderList";
import { FormMessage } from "@/components/forms/Field";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { getAddresses, getProfile, requireUser } from "@/lib/auth/session";
import { formatPkPhone } from "@/lib/checkout/phone";
import { getMyOrders } from "@/lib/orders/account";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

type Props = { searchParams: Promise<{ updated?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  await requireUser("/account");
  const [{ updated }, profile, addresses, orders] = await Promise.all([searchParams, getProfile(), getAddresses(), getMyOrders(3)]);
  const main = addresses.find((a) => a.isDefault) ?? addresses[0];

  return (
    <div className="space-y-10">
      {updated === "password" ? <FormMessage tone="success">Your password has been changed.</FormMessage> : null}

      <section aria-labelledby="recent-orders">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recent-orders" className="font-display text-2xl">
            Recent orders
          </h2>
          {orders.length > 0 ? (
            <Link href="/account/orders" className="text-sm underline underline-offset-4">
              View all
            </Link>
          ) : null}
        </div>
        <div className="mt-4">
          {orders.length > 0 ? (
            <OrderList orders={orders} />
          ) : (
            <EmptyState
              icon="bag"
              title="No orders yet"
              description="When you place an order while signed in, it appears here with its status."
              action={<ButtonLink href="/shop">Start shopping</ButtonLink>}
            />
          )}
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="profile-box" className="rounded-card border border-stone bg-surface p-5">
          <h2 id="profile-box" className="font-display text-xl">
            Profile
          </h2>
          <p className="mt-3 text-sm">{profile?.fullName || "—"}</p>
          <p className="text-sm text-ink-soft">{profile?.email}</p>
          <p className="text-sm text-ink-soft">{profile?.phone ? formatPkPhone(profile.phone) : "No phone number yet"}</p>
          <Link href="/account/profile" className="mt-4 inline-block text-sm underline underline-offset-4">
            Edit profile
          </Link>
        </section>
        <section aria-labelledby="address-box" className="rounded-card border border-stone bg-surface p-5">
          <h2 id="address-box" className="font-display text-xl">
            Default address
          </h2>
          {main ? (
            <address className="mt-3 text-sm leading-relaxed not-italic text-ink-soft">
              <span className="font-medium text-ink">{main.fullName}</span>
              <br />
              {main.line1}
              {main.line2 ? `, ${main.line2}` : ""}
              <br />
              {main.city}
            </address>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">Save an address to check out faster.</p>
          )}
          <Link href="/account/addresses" className="mt-4 inline-block text-sm underline underline-offset-4">
            Manage addresses
          </Link>
        </section>
      </div>
    </div>
  );
}
