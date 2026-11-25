/**
 * Shopping cart (Step 3).
 *
 * Line items with image, name, size/colour, SKU, unit price, quantity
 * stepper and remove; subtotal, delivery, WELCOME10 coupon and grand
 * total. Empty-cart state links back to the shop.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/StoreContext";
import { formatPKR } from "@/lib/constants";
import OrderSummary from "@/components/OrderSummary";

export default function CartPage() {
  const { items, totals, couponCode, updateQuantity, removeItem, applyCoupon, removeCoupon } =
    useCart();
  const [couponInput, setCouponInput] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [stockError, setStockError] = useState("");

  function onApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponMessage(applyCoupon(couponInput));
  }

  function onQuantity(variantId: string, quantity: number) {
    const error = updateQuantity(variantId, quantity);
    setStockError(error ?? "");
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
        <p className="text-5xl">🛒</p>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Your cart is empty</h1>
        <p className="mt-2 text-zinc-600">
          Browse the collection and add some jeans, jackets or shirts.
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Shopping Cart</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {totals.itemCount} item{totals.itemCount === 1 ? "" : "s"} in your cart
      </p>

      {stockError && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {stockError}
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((item) => (
            <article
              key={item.variantId}
              className="flex gap-4 rounded-xl border border-zinc-200 p-4"
            >
              <Link href={`/product/${item.productSlug}`} className="shrink-0">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-28 w-24 rounded-lg object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${item.productSlug}`}
                  className="font-semibold text-zinc-900 hover:text-[#0f2440]"
                >
                  {item.name}
                </Link>
                <p className="mt-1 text-sm text-zinc-600">
                  Size {item.size} · {item.color}
                </p>
                <p className="text-xs text-zinc-500">SKU: {item.sku}</p>
                <p className="mt-1 text-sm font-bold text-[#0f2440]">
                  {formatPKR(item.price)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-full border border-zinc-300">
                    <button
                      type="button"
                      onClick={() => onQuantity(item.variantId, item.quantity - 1)}
                      className="px-3 py-1.5 text-lg font-bold text-zinc-700"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onQuantity(item.variantId, item.quantity + 1)}
                      className="px-3 py-1.5 text-lg font-bold text-zinc-700"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    className="text-sm font-semibold text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                  <span className="ml-auto text-sm font-bold text-zinc-900">
                    {formatPKR(item.price * item.quantity)}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="h-fit rounded-xl border border-zinc-200 p-5 lg:sticky lg:top-32">
          <h2 className="text-lg font-bold text-zinc-900">Order Summary</h2>
          <div className="mt-4">
            <OrderSummary totals={totals} />
          </div>

          {couponCode ? (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Coupon <strong>{couponCode}</strong> applied — you saved{" "}
              {formatPKR(totals.discount)}.{" "}
              <button
                type="button"
                onClick={removeCoupon}
                className="font-bold underline"
              >
                Remove
              </button>
            </p>
          ) : (
            <form onSubmit={onApplyCoupon} className="mt-4">
              <label htmlFor="coupon" className="text-sm font-semibold text-zinc-900">
                Coupon code
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="coupon"
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="WELCOME10"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase outline-none focus:border-[#0f2440]"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#0f2440] px-4 py-2 text-sm font-bold text-white hover:bg-[#1a3a5c]"
                >
                  Apply
                </button>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Try WELCOME10 for 10% off (min. order Rs 2,000).
              </p>
            </form>
          )}
          {couponMessage && !couponCode && (
            <p className="mt-2 text-sm text-red-600">{couponMessage}</p>
          )}

          <Link
            href="/checkout"
            className="mt-6 block rounded-full bg-[#0f2440] px-6 py-3 text-center text-sm font-bold text-white hover:bg-[#1a3a5c]"
          >
            Proceed to Checkout →
          </Link>
          <Link
            href="/shop"
            className="mt-3 block text-center text-sm font-semibold text-[#0f2440] hover:underline"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}
