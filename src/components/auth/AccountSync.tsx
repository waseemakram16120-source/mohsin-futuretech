"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { setWishlistSyncOwner, wishlistStore, type WishlistEntry } from "@/lib/stores/wishlist";

const OWNER_KEY = "mft.wishlist.owner";

function readOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}
function writeOwner(id: string | null) {
  try {
    if (id) window.localStorage.setItem(OWNER_KEY, id);
    else window.localStorage.removeItem(OWNER_KEY);
  } catch {
    // storage blocked: sync still works for this page view
  }
}

/**
 * Keeps the browser wishlist in step with the signed-in account.
 *   - guest → signs in: the guest wishlist is merged into the account;
 *   - signed in elsewhere: the account's wishlist is loaded here;
 *   - signs out (or another person signs in on this device): the previous
 *     account's wishlist is removed from this browser.
 * Runs on every navigation because sign-in/out happen in Server Actions.
 */
export function AccountSync() {
  const pathname = usePathname();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let userId: string | null = null;
      try {
        const { data } = await createClient().auth.getSession();
        userId = data.session?.user.id ?? null;
      } catch {
        return; // Supabase not configured / unreachable: leave the local copy alone.
      }
      if (cancelled) return;
      const owner = readOwner();
      setWishlistSyncOwner(userId);

      if (!userId) {
        if (owner) {
          wishlistStore.set(() => []);
          writeOwner(null);
        }
        return;
      }
      if (owner === userId) return; // already in sync for this session

      // Someone else's list must not leak into this account.
      const local = owner ? [] : wishlistStore.get();
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "merge", entries: local.map((e) => ({ productId: e.productId, variantId: e.variantId })) }),
      }).catch(() => null);
      if (!res?.ok || cancelled) return;
      const { entries } = (await res.json()) as { entries: WishlistEntry[] };
      wishlistStore.set(() => entries);
      writeOwner(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  return null;
}
