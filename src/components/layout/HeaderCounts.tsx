"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { cartCount, useCart } from "@/lib/stores/cart";
import { useWishlist } from "@/lib/stores/wishlist";

function CountBadge({ count, testId }: { count: number; testId: string }) {
  if (count <= 0) return null;
  return (
    <span
      data-testid={testId}
      aria-hidden="true"
      className="absolute top-1.5 right-1 inline-flex min-w-4.5 items-center justify-center rounded-full bg-ink px-1 text-[0.625rem] leading-4.5 font-semibold text-surface"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function WishlistLink({ className }: { className: string }) {
  const count = useWishlist().length;
  return (
    <Link href="/wishlist" className={cn("relative", className)} aria-label={count ? `Wishlist, ${count} saved` : "Wishlist"}>
      <Icon name="heart" />
      <CountBadge count={count} testId="wishlist-count" />
    </Link>
  );
}

export function CartLink({ className }: { className: string }) {
  const count = cartCount(useCart());
  return (
    <Link
      href="/cart"
      className={cn("relative", className)}
      aria-label={count ? `Shopping bag, ${count} ${count === 1 ? "item" : "items"}` : "Shopping bag"}
    >
      <Icon name="bag" />
      <CountBadge count={count} testId="cart-count" />
    </Link>
  );
}
