import type { Metadata } from "next";
import { AddressBook } from "@/components/account/AddressBook";
import { getAddresses, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Addresses", robots: { index: false } };

export default async function AddressesPage() {
  await requireUser("/account/addresses");
  const addresses = await getAddresses();
  return (
    <section aria-labelledby="addresses-title">
      <h2 id="addresses-title" className="font-display text-2xl">
        Saved addresses
      </h2>
      <p className="mt-2 text-sm text-ink-soft">Your default address is filled in for you at checkout.</p>
      <div className="mt-5">
        <AddressBook addresses={addresses} max={10} />
      </div>
    </section>
  );
}
