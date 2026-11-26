"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPKR, DELIVERY_CHARGES_FLAT, FREE_DELIVERY_THRESHOLD } from "@/lib/constants";
import { useCart } from "@/context/StoreContext";
import WishlistButton from "@/components/WishlistButton";
import {
  discountPercent,
  productColors,
  productSizes,
  type StoreProduct,
} from "@/lib/data/products";

/**
 * Product detail (client): image gallery, size / colour selection with
 * per-variant stock, quantity selector, Add to Cart (Step 3 — wired to
 * the cart context) and Save to Wishlist.
 */
export default function ProductDetail({ product }: { product: StoreProduct }) {
  const { addItem } = useCart();
  const [imageIndex, setImageIndex] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cartNote, setCartNote] = useState("");
  const [cartNoteOk, setCartNoteOk] = useState(false);

  const sizes = productSizes(product);
  const colors = productColors(product);

  // The exact variant for the chosen size + colour (if both are picked).
  const selectedVariant = useMemo(() => {
    if (!size || !color) return null;
    return (
      product.variants.find((v) => v.size === size && v.color === color) ?? null
    );
  }, [product, size, color]);

  // Stock available for the current partial selection.
  const availableStock = useMemo(() => {
    let variants = product.variants;
    if (size) variants = variants.filter((v) => v.size === size);
    if (color) variants = variants.filter((v) => v.color === color);
    return variants.reduce((sum, v) => sum + v.stock, 0);
  }, [product, size, color]);

  const outOfStock = availableStock <= 0;
  const discount = discountPercent(product);

  function pickSize(next: string) {
    setSize(next);
    setCartNote("");
    setCartNoteOk(false);
    // If the chosen colour has no variant in this size, clear the colour.
    if (color && !product.variants.some((v) => v.size === next && v.color === color)) {
      setColor(null);
    }
  }

  function pickColor(next: string) {
    setColor(next);
    setCartNote("");
    setCartNoteOk(false);
    if (size && !product.variants.some((v) => v.size === size && v.color === next)) {
      setSize(null);
    }
  }

  function addToCart() {
    if (!size || !color) {
      setCartNote("Please select a size and a colour first.");
      setCartNoteOk(false);
      return;
    }
    if (!selectedVariant || selectedVariant.stock < quantity) {
      setCartNote("That size / colour combination is not available in the quantity you selected.");
      setCartNoteOk(false);
      return;
    }
    const error = addItem(
      {
        productId: product.id,
        productSlug: product.slug,
        name: product.name,
        image: product.images[0] ?? "",
        variantId: selectedVariant.id,
        sku: selectedVariant.sku,
        size,
        color,
        price: product.price,
        stock: selectedVariant.stock,
      },
      quantity,
    );
    if (error) {
      setCartNote(error);
      setCartNoteOk(false);
      return;
    }
    setCartNote(`Added ${quantity} × ${product.name} (${size} / ${color}) to your cart.`);
    setCartNoteOk(true);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Gallery */}
      <div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
          <img
            src={product.images[imageIndex]}
            alt={product.name}
            className="aspect-[4/5] w-full object-cover"
          />
        </div>
        {product.images.length > 1 && (
          <div className="mt-3 flex gap-3">
            {product.images.map((src, index) => (
              <button
                key={src}
                type="button"
                onClick={() => setImageIndex(index)}
                aria-label={`View image ${index + 1}`}
                className={`overflow-hidden rounded-lg border-2 ${
                  index === imageIndex ? "border-[#0f2440]" : "border-transparent"
                }`}
              >
                <img
                  src={src}
                  alt=""
                  className="h-20 w-16 object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
          <Link href="/" className="hover:text-[#0f2440]">Home</Link>
          {" / "}
          <Link href="/shop" className="hover:text-[#0f2440]">Shop</Link>
          {" / "}
          <Link
            href={`/category/${product.categorySlug}`}
            className="hover:text-[#0f2440]"
          >
            {product.categoryName}
          </Link>
          {" / "}
          <span className="text-zinc-900">{product.name}</span>
        </nav>

        <h1 className="mt-3 text-2xl font-bold text-zinc-900 sm:text-3xl">
          {product.name}
        </h1>

        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-extrabold text-[#0f2440]">
            {formatPKR(product.price)}
          </span>
          {product.compareAtPrice && (
            <>
              <span className="text-lg text-zinc-400 line-through">
                {formatPKR(product.compareAtPrice)}
              </span>
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                Save {discount}%
              </span>
            </>
          )}
        </div>

        <p className="mt-4 leading-relaxed text-zinc-600">{product.description}</p>

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="font-semibold text-zinc-900">SKU:</dt>
            <dd className="text-zinc-600">
              {selectedVariant
                ? selectedVariant.sku
                : `${product.variants[0]?.sku.split("-").slice(0, 2).join("-")} — varies by size / colour`}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-zinc-900">Category:</dt>
            <dd className="text-zinc-600">{product.categoryName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-zinc-900">Availability:</dt>
            <dd
              className={`font-semibold ${
                outOfStock
                  ? "text-red-600"
                  : availableStock <= 5
                    ? "text-amber-600"
                    : "text-emerald-600"
              }`}
            >
              {outOfStock
                ? "Out of Stock"
                : availableStock <= 5
                  ? `Low Stock — only ${availableStock} left`
                  : `In Stock (${availableStock} available)`}
            </dd>
          </div>
        </dl>

        {/* Colour */}
        <div className="mt-6">
          <p className="text-sm font-bold text-zinc-900">
            Colour{color ? `: ${color}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {colors.map((c) => {
              const inStockForColor = product.variants.some(
                (v) => v.color === c && v.stock > 0 && (!size || v.size === size),
              );
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => pickColor(c)}
                  disabled={!inStockForColor}
                  aria-pressed={color === c}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
                    color === c
                      ? "border-[#0f2440] bg-[#0f2440] text-white"
                      : "border-zinc-300 text-zinc-700 hover:border-[#0f2440]"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-zinc-300"
                    style={{
                      backgroundColor:
                        product.variants.find((v) => v.color === c)?.colorHex ?? "#ccc",
                    }}
                  />
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Size */}
        <div className="mt-6">
          <p className="text-sm font-bold text-zinc-900">
            Size{size ? `: ${size}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sizes.map((s) => {
              const inStockForSize = product.variants.some(
                (v) => v.size === s && v.stock > 0 && (!color || v.color === color),
              );
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => pickSize(s)}
                  disabled={!inStockForSize}
                  aria-pressed={size === s}
                  className={`min-w-11 rounded-lg border px-3 py-2 text-sm font-semibold ${
                    size === s
                      ? "border-[#0f2440] bg-[#0f2440] text-white"
                      : "border-zinc-300 text-zinc-700 hover:border-[#0f2440]"
                  } disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {selectedVariant && (
            <p className="mt-2 text-xs text-zinc-500">
              Selected variant SKU: {selectedVariant.sku} · {selectedVariant.stock} in stock
            </p>
          )}
        </div>

        {/* Quantity + Add to Cart */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-full border border-zinc-300">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-3 py-2 text-lg font-bold text-zinc-700"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-bold">{quantity}</span>
            <button
              type="button"
              onClick={() =>
                setQuantity((q) =>
                  Math.min(Math.max(availableStock, 1), q + 1),
                )
              }
              className="px-3 py-2 text-lg font-bold text-zinc-700"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={addToCart}
            disabled={outOfStock}
            className="flex-1 rounded-full bg-[#0f2440] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#1a3a5c] disabled:cursor-not-allowed disabled:bg-zinc-300 sm:flex-none sm:px-10"
          >
            {outOfStock ? "Out of Stock" : "Add to Cart"}
          </button>

          <WishlistButton
            productId={product.id}
            productName={product.name}
            variantSku={selectedVariant?.sku ?? null}
            label
          />
        </div>
        {cartNote && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              cartNoteOk
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            {cartNote}
            {cartNoteOk && (
              <>
                {" "}
                <Link href="/cart" className="font-bold underline">
                  View Cart →
                </Link>
              </>
            )}
          </p>
        )}

        {/* Payment / delivery promise (from the proposal) — in the buy box,
            like the reference stores, so shoppers see it before checkout. */}
        <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm leading-relaxed text-zinc-700">
          <p>
            <span className="font-bold text-emerald-800">
              ✓ Free delivery
            </span>{" "}
            on orders of {formatPKR(FREE_DELIVERY_THRESHOLD)} or more ·
            otherwise {formatPKR(DELIVERY_CHARGES_FLAT)} flat, across Pakistan.
          </p>
          <p className="mt-1">
            <span className="font-semibold text-zinc-900">Payment:</span> Cash
            on Delivery, EasyPaisa, JazzCash or NayaPay. EasyPaisa / JazzCash
            / NayaPay payments are verified manually by our team.
          </p>
          <p className="mt-2">
            <Link
              href="/track"
              className="font-semibold text-[#0f2440] hover:underline"
            >
              Track your order →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
