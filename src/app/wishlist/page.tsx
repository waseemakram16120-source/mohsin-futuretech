/**
 * Wishlist (Step 3).
 *
 * Saved items (localStorage, synced to Supabase when signed in). Each
 * item can be moved to the cart in the size/colour the customer saved
 * (or the first in-stock variant when none was chosen), or removed.
 */
"use client";

import Link from "next/link";
import { useWishlist, useCart } from "@/context/StoreContext";
import { LOCAL_PRODUCTS } from "@/lib/data/products";
import { formatPKR } from "@/lib/constants";

export default function WishlistPage() {
  const { entries, toggleWishlist } = useWishlist();
  const { addItem } = useCart();
  const products = LOCAL_PRODUCTS.filter((p) =>
    entries.some((e) => e.productId === p.id),
  );

  if (products.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
        <p className="text-5xl">♡</p>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Your wishlist is empty</h1>
        <p className="mt-2 text-zinc-600">
          Tap the heart on any product to save it here for later.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-full bg-[#0f2440] px-8 py-3 text-sm font-bold text-white hover:bg-[#1a3a5c]"
        >
          Browse Products
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">My Wishlist</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {products.length} saved item{products.length === 1 ? "" : "s"}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const savedVariantSku = entries.find(
            (e) => e.productId === product.id,
          )?.variantSku;
          // Move the size/colour the customer saved (matched by SKU — the
          // one identifier shared by the live database and this local
          // catalogue); fall back to the first in-stock variant when none
          // was chosen (e.g. saved from a product card) or the saved one
          // sold out.
          const variant =
            (savedVariantSku
              ? product.variants.find(
                  (v) => v.sku === savedVariantSku && v.stock > 0,
                )
              : undefined) ?? product.variants.find((v) => v.stock > 0);
          return (
            <article
              key={product.id}
              className="flex gap-4 rounded-xl border border-zinc-200 p-4"
            >
              <Link href={`/product/${product.slug}`} className="shrink-0">
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-28 w-24 rounded-lg object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${product.slug}`}
                  className="font-semibold text-zinc-900 hover:text-[#0f2440]"
                >
                  {product.name}
                </Link>
                <p className="mt-1 text-sm font-bold text-[#0f2440]">
                  {formatPKR(product.price)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!variant}
                    onClick={() => {
                      if (!variant) return;
                      addItem(
                        {
                          productId: product.id,
                          productSlug: product.slug,
                          name: product.name,
                          image: product.images[0] ?? "",
                          variantId: variant.id,
                          sku: variant.sku,
                          size: variant.size,
                          color: variant.color,
                          price: product.price,
                          stock: variant.stock,
                        },
                        1,
                      );
                    }}
                    className="rounded-full bg-[#0f2440] px-4 py-2 text-xs font-bold text-white hover:bg-[#1a3a5c] disabled:bg-zinc-300"
                  >
                    {variant
                      ? `Move to Cart (${variant.size} / ${variant.color})`
                      : "Out of Stock"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-red-300 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
