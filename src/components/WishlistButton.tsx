/**
 * Wishlist heart toggle (Step 3). Client component — safe to render
 * inside server components such as ProductCard.
 */
"use client";

import { useWishlist } from "@/context/StoreContext";

export default function WishlistButton({
  productId,
  productName,
  label = false,
}: {
  productId: string;
  productName: string;
  label?: boolean;
}) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const active = isWishlisted(productId);
  return (
    <button
      type="button"
      onClick={() => toggleWishlist(productId)}
      aria-pressed={active}
      aria-label={active ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      title={active ? "Saved in your wishlist" : "Save to wishlist"}
      className={`flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-red-200 bg-red-50 text-red-600"
          : "border-zinc-300 text-zinc-700 hover:border-red-300 hover:text-red-600"
      }`}
    >
      <span aria-hidden>{active ? "♥" : "♡"}</span>
      {label && <span>{active ? "Saved" : "Save to Wishlist"}</span>}
    </button>
  );
}
