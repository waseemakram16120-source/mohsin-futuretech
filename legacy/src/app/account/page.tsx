/**
 * My Account (Step 3).
 *
 * Signed-in customers (Supabase configured): profile, saved addresses
 * (CRUD on the `addresses` table) and order history from the database.
 * Without Supabase, the page shows a clear notice and the same sections
 * work against the demo localStorage data (profile, addresses, orders
 * placed on this device as a guest).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatPKR, ORDER_STATUSES } from "@/lib/constants";
import {
  getDemoAddresses,
  getDemoOrders,
  getDemoProfile,
  saveDemoAddresses,
  saveDemoProfile,
  type DemoAddress,
  type DemoOrder,
} from "@/lib/demo-orders";
import type { Address, Order } from "@/lib/types";

interface HistoryOrder {
  orderNumber: string;
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  demo: boolean;
}

export default function AccountPage() {
  const router = useRouter();
  const { user, profile, configured, loading, signOut, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [demoAddresses, setDemoAddresses] = useState<DemoAddress[]>([]);
  const [history, setHistory] = useState<HistoryOrder[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressMessage, setAddressMessage] = useState("");
  const [newAddress, setNewAddress] = useState({
    label: "Home",
    fullName: "",
    phone: "",
    addressLine1: "",
    city: "",
    province: "",
    postalCode: "",
  });

  const loadLiveData = useCallback(async () => {
    if (!user) return;
    setAddressesLoading(true);
    try {
      const supabase = createClient();
      const [{ data: addr }, { data: orders }] = await Promise.all([
        supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }),
        supabase.from("orders").select("order_number, total_amount, status, payment_method, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setAddresses((addr ?? []) as Address[]);
      const live: HistoryOrder[] = ((orders ?? []) as Array<{ order_number: string; total_amount: number; status: string; payment_method: string; created_at: string }>).map((o) => ({
        orderNumber: o.order_number,
        total: o.total_amount,
        status: o.status,
        paymentMethod: o.payment_method,
        createdAt: o.created_at,
        demo: false,
      }));
      const demo: HistoryOrder[] = getDemoOrders().map((o: DemoOrder) => ({
        orderNumber: o.orderNumber,
        total: o.totalAmount,
        status: o.status,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
        demo: true,
      }));
      setHistory([...live, ...demo].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } finally {
      setAddressesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (configured && !user) {
      // Signed out (or session dropped): clear the previous user's live data
      // so their addresses/orders never show on the guest view after logout.
      setAddresses([]);
      setHistory([]);
      router.replace("/login?next=/account");
      return;
    }
    if (profile) {
      setName(profile.full_name);
      setPhone(profile.phone ?? "");
    } else if (!configured) {
      const demo = getDemoProfile();
      if (demo) {
        setName(demo.fullName);
        setPhone(demo.phone);
      }
      setDemoAddresses(getDemoAddresses());
      setHistory(
        getDemoOrders().map((o) => ({
          orderNumber: o.orderNumber,
          total: o.totalAmount,
          status: o.status,
          paymentMethod: o.paymentMethod,
          createdAt: o.createdAt,
          demo: true,
        })),
      );
    }
    if (user) void loadLiveData();
    else setAddressesLoading(false);
  }, [loading, configured, user, profile, router, loadLiveData]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) {
      setProfileMessage("Please enter your full name.");
      return;
    }
    if (user && configured) {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name.trim(), phone: phone.trim() || null })
        .eq("id", user.id);
      if (error) {
        setProfileMessage("Could not save your profile. Please try again.");
        return;
      }
      await refreshProfile();
      setProfileMessage("Profile saved.");
      return;
    }
    saveDemoProfile({ fullName: name.trim(), phone: phone.trim() });
    setProfileMessage("Profile saved on this device (demo mode).");
  }

  async function onAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (newAddress.fullName.trim().length < 3 || newAddress.addressLine1.trim().length < 10 || newAddress.city.trim().length < 2) {
      return;
    }
    if (user && configured) {
      const supabase = createClient();
      const { error } = await supabase.from("addresses").insert({
        user_id: user.id,
        label: newAddress.label.trim() || "Home",
        full_name: newAddress.fullName.trim(),
        phone: newAddress.phone.trim(),
        address_line1: newAddress.addressLine1.trim(),
        city: newAddress.city.trim(),
        province: newAddress.province.trim() || null,
        postal_code: newAddress.postalCode.trim() || null,
        is_default: addresses.length === 0,
      });
      if (error) {
        setAddressMessage("Could not save the address. Please try again.");
        return;
      }
      setNewAddress({ label: "Home", fullName: "", phone: "", addressLine1: "", city: "", province: "", postalCode: "" });
      setShowAddressForm(false);
      setAddressMessage("Address saved.");
      await loadLiveData();
      return;
    }
    const next: DemoAddress = {
      id: `addr-${Date.now()}`,
      label: newAddress.label.trim() || "Home",
      fullName: newAddress.fullName.trim(),
      phone: newAddress.phone.trim(),
      addressLine1: newAddress.addressLine1.trim(),
      city: newAddress.city.trim(),
      province: newAddress.province.trim(),
      postalCode: newAddress.postalCode.trim(),
      isDefault: demoAddresses.length === 0,
    };
    const updated = [...demoAddresses.map((a) => ({ ...a, isDefault: false })), next];
    setDemoAddresses(updated);
    saveDemoAddresses(updated);
    setNewAddress({ label: "Home", fullName: "", phone: "", addressLine1: "", city: "", province: "", postalCode: "" });
    setShowAddressForm(false);
  }

  async function onDeleteAddress(id: string) {
    if (user && configured) {
      await createClient().from("addresses").delete().eq("id", id);
      await loadLiveData();
      return;
    }
    const updated = demoAddresses.filter((a) => a.id !== id);
    setDemoAddresses(updated);
    saveDemoAddresses(updated);
  }

  async function onSetDefault(id: string) {
    if (user && configured) {
      const supabase = createClient();
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
      await supabase.from("addresses").update({ is_default: true }).eq("id", id);
      await loadLiveData();
      return;
    }
    const updated = demoAddresses.map((a) => ({ ...a, isDefault: a.id === id }));
    setDemoAddresses(updated);
    saveDemoAddresses(updated);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <p className="text-zinc-600">Loading your account…</p>
      </main>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-[#0f2440]";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">My Account</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {user ? user.email : "Guest account — saved on this device"}
          </p>
        </div>
        {user && (
          <button
            type="button"
            onClick={() => {
              void signOut();
              router.push("/");
              router.refresh();
            }}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-red-400 hover:text-red-600"
          >
            Logout
          </button>
        )}
      </div>

      {!configured && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Demo mode — the store database (Supabase) is not connected yet, so your
          profile, addresses and orders are saved in this browser only. Sign-in
          needs the Supabase project; guest checkout and order tracking still work.
        </p>
      )}

      {/* Profile */}
      <section className="mt-6 rounded-xl border border-zinc-200 p-5">
        <h2 className="text-lg font-bold text-zinc-900">Profile</h2>
        <form onSubmit={onSaveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="text-sm font-semibold text-zinc-900">Full name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="phone" className="text-sm font-semibold text-zinc-900">Phone</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="0300 1234567" inputMode="tel" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-full bg-[#0f2440] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1a3a5c]">
              Save Profile
            </button>
            {profileMessage && <span className="ml-3 text-sm text-emerald-700">{profileMessage}</span>}
          </div>
        </form>
      </section>

      {/* Addresses */}
      <section className="mt-6 rounded-xl border border-zinc-200 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">Saved Addresses</h2>
          <button
            type="button"
            onClick={() => {
              setShowAddressForm((v) => !v);
              setAddressMessage("");
            }}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-[#0f2440] hover:border-[#0f2440]"
          >
            {showAddressForm ? "Cancel" : "+ Add Address"}
          </button>
        </div>

        {showAddressForm && (
          <form onSubmit={onAddAddress} className="mt-4 grid gap-4 rounded-lg bg-zinc-50 p-4 sm:grid-cols-2">
            <div>
              <label htmlFor="addr-label" className="text-sm font-semibold text-zinc-900">Label</label>
              <input id="addr-label" value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })} className={inputClass} placeholder="Home / Office" />
            </div>
            <div>
              <label htmlFor="addr-name" className="text-sm font-semibold text-zinc-900">Full name *</label>
              <input id="addr-name" value={newAddress.fullName} onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })} className={inputClass} required />
            </div>
            <div>
              <label htmlFor="addr-phone" className="text-sm font-semibold text-zinc-900">Phone *</label>
              <input id="addr-phone" value={newAddress.phone} onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })} className={inputClass} required inputMode="tel" />
            </div>
            <div>
              <label htmlFor="addr-city" className="text-sm font-semibold text-zinc-900">City *</label>
              <input id="addr-city" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} className={inputClass} required />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="addr-line" className="text-sm font-semibold text-zinc-900">Address *</label>
              <input id="addr-line" value={newAddress.addressLine1} onChange={(e) => setNewAddress({ ...newAddress, addressLine1: e.target.value })} className={inputClass} placeholder="House no., street, area" required />
            </div>
            <div>
              <label htmlFor="addr-province" className="text-sm font-semibold text-zinc-900">Province</label>
              <input id="addr-province" value={newAddress.province} onChange={(e) => setNewAddress({ ...newAddress, province: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="addr-postal" className="text-sm font-semibold text-zinc-900">Postal code</label>
              <input id="addr-postal" value={newAddress.postalCode} onChange={(e) => setNewAddress({ ...newAddress, postalCode: e.target.value })} className={inputClass} inputMode="numeric" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-full bg-[#0f2440] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1a3a5c]">
                Save Address
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 space-y-3">
          {addresses.map((a) => (
            <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-zinc-200 p-4 text-sm">
              <div>
                <p className="font-bold text-zinc-900">
                  {a.label} — {a.full_name}
                  {a.is_default && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">Default</span>}
                </p>
                <p className="text-zinc-600">{a.address_line1}, {a.city}</p>
                <p className="text-zinc-500">{a.phone}</p>
              </div>
              <div className="flex gap-3">
                {!a.is_default && (
                  <button type="button" onClick={() => void onSetDefault(a.id)} className="font-semibold text-[#0f2440] hover:underline">Set default</button>
                )}
                <button type="button" onClick={() => void onDeleteAddress(a.id)} className="font-semibold text-red-600 hover:underline">Delete</button>
              </div>
            </div>
          ))}
          {demoAddresses.map((a) => (
            <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-zinc-200 p-4 text-sm">
              <div>
                <p className="font-bold text-zinc-900">
                  {a.label} — {a.fullName}
                  {a.isDefault && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">Default</span>}
                </p>
                <p className="text-zinc-600">{a.addressLine1}, {a.city}</p>
                <p className="text-zinc-500">{a.phone}</p>
              </div>
              <div className="flex gap-3">
                {!a.isDefault && (
                  <button type="button" onClick={() => void onSetDefault(a.id)} className="font-semibold text-[#0f2440] hover:underline">Set default</button>
                )}
                <button type="button" onClick={() => void onDeleteAddress(a.id)} className="font-semibold text-red-600 hover:underline">Delete</button>
              </div>
            </div>
          ))}
          {addressMessage && (
            <p className="text-sm font-semibold text-emerald-700">{addressMessage}</p>
          )}
          {configured && user && addressesLoading && (
            <p className="text-sm text-zinc-500">Loading your addresses…</p>
          )}
          {addresses.length === 0 && demoAddresses.length === 0 && !showAddressForm && !addressesLoading && (
            <p className="text-sm text-zinc-500">No saved addresses yet. Add one to speed up checkout.</p>
          )}
        </div>
      </section>

      {/* Order history */}
      <section className="mt-6 rounded-xl border border-zinc-200 p-5">
        <h2 className="text-lg font-bold text-zinc-900">Order History</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No orders yet.{" "}
            <Link href="/shop" className="font-semibold text-[#0f2440] hover:underline">Start shopping →</Link>
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {history.map((o) => (
              <li key={o.orderNumber} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <Link href={`/account/orders/${o.orderNumber}`} className="font-bold text-[#0f2440] hover:underline">
                    {o.orderNumber}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {new Date(o.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                    {o.demo ? " · Demo order" : ""}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">
                  {ORDER_STATUSES.find((s) => s.value === o.status)?.label ?? o.status}
                </span>
                <span className="font-bold text-zinc-900">{formatPKR(o.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
