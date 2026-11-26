/**
 * Checkout (Step 3).
 *
 * Delivery details + payment method + order summary, with full inline
 * validation before submit (PDF §3). Guest checkout is allowed; signed-in
 * customers get their profile and saved addresses pre-filled. The payment
 * method is only SELECTED here — wallet (EasyPaisa / JazzCash / NayaPay)
 * Transaction ID and receipt-screenshot submission arrive in Step 4.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatPKR, PAYMENT_METHODS } from "@/lib/constants";
import { getPaymentAccount } from "@/lib/payments";
import { isValidPakistaniPhone, normalizePhone } from "@/lib/cart";
import {
  buildDemoOrder,
  getDemoAddresses,
  getDemoProfile,
  saveDemoAddresses,
  saveDemoOrder,
  saveDemoProfile,
  type DemoAddress,
} from "@/lib/demo-orders";
import type { PaymentMethod } from "@/lib/types";
import OrderSummary from "@/components/OrderSummary";

interface AddressOption {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
}

type FieldErrors = Partial<Record<"name" | "phone" | "address" | "city", string>>;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totals, couponCode, applyCoupon, removeCoupon, clearCart } = useCart();
  const { user, profile, configured } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [saveAddress, setSaveAddress] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<AddressOption[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [couponInput, setCouponInput] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from profile + saved addresses (Supabase when signed in,
  // demo localStorage otherwise).
  useEffect(() => {
    if (profile) {
      setName((v) => v || profile.full_name);
      setPhone((v) => v || profile.phone || "");
    } else if (!user) {
      const demo = getDemoProfile();
      if (demo) {
        setName((v) => v || demo.fullName);
        setPhone((v) => v || demo.phone);
      }
    }
  }, [profile, user]);

  useEffect(() => {
    async function loadAddresses() {
      if (user && configured) {
        try {
          const supabase = createClient();
          const { data } = await supabase
            .from("addresses")
            .select("*")
            .eq("user_id", user.id)
            .order("is_default", { ascending: false });
          const rows = (data ?? []) as Array<{
            id: string;
            label: string;
            full_name: string;
            phone: string;
            address_line1: string;
            city: string;
            province: string | null;
            postal_code: string | null;
          }>;
          const mapped: AddressOption[] = rows.map((r) => ({
            id: r.id,
            label: r.label,
            fullName: r.full_name,
            phone: r.phone,
            addressLine1: r.address_line1,
            city: r.city,
            province: r.province ?? "",
            postalCode: r.postal_code ?? "",
          }));
          setSavedAddresses(mapped);
          const def = mapped[0];
          if (def) {
            setSelectedAddressId(def.id);
            fillFromAddress(def);
          }
          return;
        } catch {
          // Fall through to demo addresses.
        }
      }
      if (!user) {
        const demo = getDemoAddresses();
        const mapped: AddressOption[] = demo.map((d) => ({
          id: d.id,
          label: d.label,
          fullName: d.fullName,
          phone: d.phone,
          addressLine1: d.addressLine1,
          city: d.city,
          province: d.province,
          postalCode: d.postalCode,
        }));
        setSavedAddresses(mapped);
        const def = mapped.find((a) => demo.find((d) => d.id === a.id)?.isDefault) ?? mapped[0];
        if (def) {
          setSelectedAddressId(def.id);
          fillFromAddress(def);
        }
      }
    }
    void loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, configured]);

  function fillFromAddress(a: AddressOption) {
    setName(a.fullName);
    setPhone(a.phone);
    setAddress(a.addressLine1);
    setCity(a.city);
    setProvince(a.province);
    setPostalCode(a.postalCode);
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (name.trim().length < 3) next.name = "Please enter your full name.";
    if (!isValidPakistaniPhone(phone))
      next.phone = "Enter a valid Pakistani mobile number, e.g. 0300 1234567.";
    if (address.trim().length < 10)
      next.address = "Please enter your full delivery address (house, street, area).";
    if (city.trim().length < 2) next.city = "Please enter your city.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (items.length === 0) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          customer: {
            name: name.trim(),
            phone: normalizePhone(phone),
            address: address.trim(),
            city: city.trim(),
            province: province.trim() || undefined,
            postalCode: postalCode.trim() || undefined,
            notes: notes.trim() || undefined,
          },
          paymentMethod,
          couponCode: couponCode ?? undefined,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        mode?: string;
        orderNumber?: string;
        subtotal?: number;
        deliveryCharges?: number;
        discountAmount?: number;
        couponCode?: string | null;
        totalAmount?: number;
        paymentMethod?: PaymentMethod;
        items?: Array<{
          productId: string | null;
          variantId: string | null;
          productName: string;
          variantLabel: string | null;
          sku: string | null;
          unitPrice: number;
          quantity: number;
          lineTotal: number;
          image: string;
        }>;
      };
      if (!response.ok || !result.orderNumber) {
        setSubmitError(result.error ?? "Could not place your order. Please try again.");
        return;
      }

      // Remember the customer for next time (demo localStorage, or Supabase).
      if (result.mode === "demo") {
        const demoOrder = buildDemoOrder({
          orderNumber: result.orderNumber,
          customer: {
            name: name.trim(),
            phone: normalizePhone(phone),
            address: address.trim(),
            city: city.trim(),
            province: province.trim() || undefined,
            postalCode: postalCode.trim() || undefined,
            notes: notes.trim() || undefined,
          },
          items,
          subtotal: result.subtotal ?? totals.subtotal,
          deliveryCharges: result.deliveryCharges ?? totals.delivery,
          discountAmount: result.discountAmount ?? totals.discount,
          couponCode: result.couponCode ?? couponCode,
          totalAmount: result.totalAmount ?? totals.total,
          paymentMethod,
        });
        saveDemoOrder(demoOrder);
        saveDemoProfile({ fullName: name.trim(), phone: normalizePhone(phone) });
        if (saveAddress && !user) {
          const existing = getDemoAddresses();
          const already = existing.some(
            (a) => a.addressLine1.trim() === address.trim(),
          );
          if (!already) {
            saveDemoAddresses([
              ...existing.map((a) => ({ ...a, isDefault: false })),
              {
                id: `addr-${Date.now()}`,
                label: "Home",
                fullName: name.trim(),
                phone: normalizePhone(phone),
                addressLine1: address.trim(),
                city: city.trim(),
                province: province.trim(),
                postalCode: postalCode.trim(),
                isDefault: existing.length === 0,
              },
            ]);
          }
        }
      } else if (saveAddress && user && configured) {
        try {
          const supabase = createClient();
          await supabase.from("addresses").insert({
            user_id: user.id,
            label: "Home",
            full_name: name.trim(),
            phone: normalizePhone(phone),
            address_line1: address.trim(),
            city: city.trim(),
            province: province.trim() || null,
            postal_code: postalCode.trim() || null,
            is_default: savedAddresses.length === 0,
          });
        } catch {
          // Non-fatal — the order itself is already placed.
        }
      }

      clearCart();
      // Wallet payments (EasyPaisa / JazzCash / NayaPay) go straight to the
      // payment page so the customer submits the Transaction ID + screenshot
      // right away instead of hunting for the link. COD goes to the
      // order-success page as before.
      if (
        paymentMethod === "easypaisa" ||
        paymentMethod === "jazzcash" ||
        paymentMethod === "nayapay"
      ) {
        router.push(`/pay/${encodeURIComponent(result.orderNumber)}`);
      } else {
        router.push(
          `/order-success?order=${encodeURIComponent(result.orderNumber)}&mode=${result.mode ?? "live"}`,
        );
      }
    } catch {
      setSubmitError("Could not place your order. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-zinc-900">Your cart is empty</h1>
        <p className="mt-2 text-zinc-600">
          Add some products to your cart before checking out.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-full bg-[#0f2440] px-8 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c]"
        >
          Continue Shopping
        </Link>
      </main>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-[#0f2440]";
  const errorClass = "mt-1 text-xs font-semibold text-red-600";
  const method = PAYMENT_METHODS.find((m) => m.value === paymentMethod)!;
  const walletAccount =
    paymentMethod === "easypaisa" ||
    paymentMethod === "jazzcash" ||
    paymentMethod === "nayapay"
      ? getPaymentAccount(paymentMethod)
      : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Checkout</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Enter your delivery details, choose a payment method and place your order.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-8 lg:grid-cols-3" noValidate>
        <div className="space-y-6 lg:col-span-2">
          {/* Saved addresses */}
          {savedAddresses.length > 0 && (
            <section className="rounded-xl border border-zinc-200 p-5">
              <h2 className="text-lg font-bold text-zinc-900">Saved Addresses</h2>
              <div className="mt-3 space-y-2">
                {savedAddresses.map((a) => (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                      selectedAddressId === a.id
                        ? "border-[#0f2440] bg-[#0f2440]/5"
                        : "border-zinc-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="saved-address"
                      checked={selectedAddressId === a.id}
                      onChange={() => {
                        setSelectedAddressId(a.id);
                        fillFromAddress(a);
                      }}
                      className="mt-1 accent-[#0f2440]"
                    />
                    <span>
                      <span className="font-bold text-zinc-900">{a.label} — {a.fullName}</span>
                      <span className="block text-zinc-600">
                        {a.addressLine1}, {a.city}
                      </span>
                      <span className="block text-zinc-500">{a.phone}</span>
                    </span>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAddressId("");
                    setName("");
                    setPhone("");
                    setAddress("");
                    setCity("");
                    setProvince("");
                    setPostalCode("");
                  }}
                  className="text-sm font-semibold text-[#0f2440] hover:underline"
                >
                  + Use a new address
                </button>
              </div>
            </section>
          )}

          {/* Delivery details */}
          <section className="rounded-xl border border-zinc-200 p-5">
            <h2 className="text-lg font-bold text-zinc-900">Delivery Details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="text-sm font-semibold text-zinc-900">
                  Full name *
                </label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Ahmed Raza" autoComplete="name" />
                {errors.name && <p className={errorClass}>{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="phone" className="text-sm font-semibold text-zinc-900">
                  Phone number *
                </label>
                <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="0300 1234567" autoComplete="tel" inputMode="tel" />
                {errors.phone && <p className={errorClass}>{errors.phone}</p>}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="address" className="text-sm font-semibold text-zinc-900">
                  Full delivery address *
                </label>
                <textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={inputClass} placeholder="House no., street, area / mohalla" autoComplete="street-address" />
                {errors.address && <p className={errorClass}>{errors.address}</p>}
              </div>
              <div>
                <label htmlFor="city" className="text-sm font-semibold text-zinc-900">
                  City *
                </label>
                <input id="city" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} placeholder="e.g. Lahore" autoComplete="address-level2" />
                {errors.city && <p className={errorClass}>{errors.city}</p>}
              </div>
              <div>
                <label htmlFor="province" className="text-sm font-semibold text-zinc-900">
                  Province (optional)
                </label>
                <input id="province" value={province} onChange={(e) => setProvince(e.target.value)} className={inputClass} placeholder="e.g. Punjab" />
              </div>
              <div>
                <label htmlFor="postal" className="text-sm font-semibold text-zinc-900">
                  Postal code (optional)
                </label>
                <input id="postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} placeholder="e.g. 54000" inputMode="numeric" />
              </div>
              <div>
                <label htmlFor="notes" className="text-sm font-semibold text-zinc-900">
                  Order notes (optional)
                </label>
                <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Any delivery instructions?" />
              </div>
            </div>
            {user && (
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.checked)}
                  className="accent-[#0f2440]"
                />
                Save this address to my account for next time
              </label>
            )}
            {!user && (
              <p className="mt-2 text-xs text-zinc-500">
                You are checking out as a guest.{" "}
                <Link href="/login?next=/checkout" className="font-semibold text-[#0f2440] hover:underline">
                  Log in
                </Link>{" "}
                to save addresses and see your order history in your account.
              </p>
            )}
          </section>

          {/* Payment method */}
          <section className="rounded-xl border border-zinc-200 p-5">
            <h2 className="text-lg font-bold text-zinc-900">Payment Method</h2>
            <div className="mt-3 space-y-2" role="radiogroup" aria-label="Payment method">
              {PAYMENT_METHODS.map((m) => (
                <label
                  key={m.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                    paymentMethod === m.value
                      ? "border-[#0f2440] bg-[#0f2440]/5"
                      : "border-zinc-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === m.value}
                    onChange={() => setPaymentMethod(m.value)}
                    className="mt-1 accent-[#0f2440]"
                  />
                  <span>
                    <span className="block text-sm font-bold text-zinc-900">{m.label}</span>
                    <span className="block text-sm text-zinc-600">{m.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
              {method.instructions}
            </p>
            {walletAccount && (
              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p className="font-bold">How to pay with {method.label}:</p>
                <p className="mt-1">
                  Send {formatPKR(totals.total)} to{" "}
                  {walletAccount.configured ? (
                    <>
                      <strong>{walletAccount.accountName}</strong> —{" "}
                      <strong>{walletAccount.accountNumber}</strong>
                    </>
                  ) : (
                    "the store's account (account details to be added by the store owner)"
                  )}
                  . After placing this order, submit your Transaction ID and
                  payment screenshot on the next page — your payment will stay
                  Pending Verification until the store approves it.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Order summary */}
        <aside className="h-fit rounded-xl border border-zinc-200 p-5 lg:sticky lg:top-32">
          <h2 className="text-lg font-bold text-zinc-900">Order Summary</h2>
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li key={item.variantId} className="flex gap-3 text-sm">
                <img src={item.image} alt="" className="h-14 w-12 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900">{item.name}</p>
                  <p className="text-xs text-zinc-500">
                    {item.size} / {item.color} × {item.quantity}
                  </p>
                </div>
                <span className="font-semibold whitespace-nowrap text-zinc-900">
                  {formatPKR(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-zinc-200 pt-4">
            <OrderSummary totals={totals} />
          </div>

          {couponCode ? (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Coupon <strong>{couponCode}</strong> applied — saved {formatPKR(totals.discount)}.{" "}
              <button type="button" onClick={removeCoupon} className="font-bold underline">
                Remove
              </button>
            </p>
          ) : (
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Coupon code"
                aria-label="Coupon code"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase outline-none focus:border-[#0f2440]"
              />
              <button
                type="button"
                onClick={() => setCouponMessage(applyCoupon(couponInput))}
                className="rounded-lg bg-[#0f2440] px-4 py-2 text-sm font-bold text-white hover:bg-[#1a3a5c]"
              >
                Apply
              </button>
            </div>
          )}
          {couponMessage && !couponCode && (
            <p className="mt-2 text-sm text-red-600">{couponMessage}</p>
          )}

          {submitError && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-full bg-[#0f2440] px-6 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c] disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {submitting ? "Placing your order…" : `Place Order · ${formatPKR(totals.total)}`}
          </button>
          {paymentMethod !== "cod" && (
            <p className="mt-2 text-center text-xs text-zinc-500">
              After placing your order, you&apos;ll go straight to the payment
              page to send the payment and submit your Transaction ID.
            </p>
          )}
          <p className="mt-2 text-center text-xs text-zinc-500">
            By placing this order you agree to pay {method.shortLabel === "COD" ? "in cash on delivery" : "as per the payment instructions"}.
          </p>
        </aside>
      </form>
    </main>
  );
}
