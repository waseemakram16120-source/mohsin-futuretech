"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { toggleWishlist, useWishlist } from "@/lib/stores/wishlist";

/** Heart toggle. `variant="overlay"` sits on product images. */
export function WishlistButton({
  productId,
  productName,
  variantId = null,
  variant = "overlay",
  className,
}: {
  productId: string;
  productName: string;
  variantId?: string | null;
  variant?: "overlay" | "inline";
  className?: string;
}) {
  const saved = useWishlist().some((e) => e.productId === productId);
  const label = saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`;

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      title={saved ? "Saved to wishlist" : "Save to wishlist"}
      onClick={(event) => {
        event.preventDefault();
        toggleWishlist(productId, variantId);
      }}
      className={cn(
        "inline-flex items-center justify-center transition-colors",
        variant === "overlay"
          ? "size-10 rounded-full bg-surface/90 text-ink shadow-sm backdrop-blur hover:bg-surface"
          : "size-13 shrink-0 rounded-xs border border-stone-strong bg-surface text-ink hover:border-ink",
        className,
      )}
    >
      <Icon name="heart" className={cn("size-5 transition-transform", saved && "scale-110 fill-sale text-sale")} />
    </button>
  );
}
