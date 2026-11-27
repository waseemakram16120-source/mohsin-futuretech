"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { storeConfig } from "@/config/store";
import { createLocalStore } from "./local-store";

/**
 * Wishlist kept in the browser. For signed-in customers it is mirrored to
 * the `wishlist` table (see components/auth/AccountSync.tsx), so it follows
 * them to other devices.
 */
export const MAX_WISHLIST: number = storeConfig.wishlist.maxItems;

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

/** Signed-in owner of the local copy (set by AccountSync), or null for a guest. */
let syncOwner: string | null = null;
export function setWishlistSyncOwner(userId: string | null) {
  syncOwner = userId;
}

export function toggleWishlist(productId: string, variantId: string | null = null) {
  const wasSaved = wishlistStore.get().some((e) => e.productId === productId);
  wishlistStore.set((entries) => toggleEntry(entries, productId, variantId));
  if (syncOwner) {
    // Best effort: the local copy is already updated; the server follows.
    void fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wasSaved ? { op: "remove", productId } : { op: "add", productId, variantId }),
    }).catch(() => undefined);
  }
}

export function useWishlist(): WishlistEntry[] {
  return useSyncExternalStore(wishlistStore.subscribe, wishlistStore.get, wishlistStore.getServerSnapshot);
}
