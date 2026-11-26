"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { createLocalStore } from "./local-store";

/**
 * Wishlist kept in the browser (guests). Phase 6 syncs it to the
 * `wishlist` table for signed-in customers.
 */
export const MAX_WISHLIST = 100;

const entrySchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().default(null),
  addedAt: z.string(),
});
export type WishlistEntry = z.infer<typeof entrySchema>;

export const wishlistStore = createLocalStore<WishlistEntry[]>(
  "mft.wishlist.v1",
  z.array(entrySchema).max(MAX_WISHLIST),
  [],
);

/** Pure toggle: newest first, one entry per product. */
export function toggleEntry(
  entries: WishlistEntry[],
  productId: string,
  variantId: string | null = null,
  now = new Date().toISOString(),
): WishlistEntry[] {
  if (entries.some((e) => e.productId === productId)) return entries.filter((e) => e.productId !== productId);
  return [{ productId, variantId, addedAt: now }, ...entries].slice(0, MAX_WISHLIST);
}

export function toggleWishlist(productId: string, variantId: string | null = null) {
  wishlistStore.set((entries) => toggleEntry(entries, productId, variantId));
}

export function useWishlist(): WishlistEntry[] {
  return useSyncExternalStore(wishlistStore.subscribe, wishlistStore.get, wishlistStore.getServerSnapshot);
}
