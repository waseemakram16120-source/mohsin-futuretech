/**
 * Cart + wishlist state (Step 3).
 *
 * Both persist in localStorage, so a guest customer keeps their cart and
 * wishlist without logging in. When the customer IS signed in and
 * Supabase is configured, the wishlist also syncs to the `wishlist`
 * table (best-effort — a failed sync never breaks the local wishlist).
 * The cart itself stays local-only, per the proposal (no server cart).
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/data/store-client";
import {
  CART_STORAGE_KEY,
  WISHLIST_STORAGE_KEY,
  computeTotals,
  type CartItem,
  type CartTotals,
} from "@/lib/cart";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — state still works in memory.
  }
}

/* ---------------------------------- cart ---------------------------------- */

interface CartContextValue {
  items: CartItem[];
  totals: CartTotals;
  couponCode: string | null;
  /** Adds an item; returns an error message when the variant stock blocks it. */
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => string | null;
  updateQuantity: (variantId: string, quantity: number) => string | null;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => string;
  removeCoupon: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

/* -------------------------------- wishlist -------------------------------- */

interface WishlistContextValue {
  productIds: string[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside CartProvider");
  return ctx;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state once, on the client.
  useEffect(() => {
    setItems(load<CartItem[]>(CART_STORAGE_KEY, []));
    setProductIds(load<string[]>(WISHLIST_STORAGE_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) save(CART_STORAGE_KEY, items);
  }, [items, hydrated]);

  useEffect(() => {
    if (hydrated) save(WISHLIST_STORAGE_KEY, productIds);
  }, [productIds, hydrated]);

  const totals = useMemo(
    () => computeTotals(items, couponCode),
    [items, couponCode],
  );

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1): string | null => {
      const existing = items.find((i) => i.variantId === item.variantId);
      const wanted = (existing?.quantity ?? 0) + quantity;
      if (wanted > item.stock) {
        return `Only ${item.stock} left in stock for this size / colour.`;
      }
      if (existing) {
        setItems((prev) =>
          prev.map((i) =>
            i.variantId === item.variantId
              ? { ...i, quantity: wanted }
              : i,
          ),
        );
      } else {
        setItems((prev) => [...prev, { ...item, quantity }]);
      }
      return null;
    },
    [items],
  );

  const updateQuantity = useCallback(
    (variantId: string, quantity: number): string | null => {
      const item = items.find((i) => i.variantId === variantId);
      if (!item) return null;
      if (quantity <= 0) {
        setItems((prev) => prev.filter((i) => i.variantId !== variantId));
        return null;
      }
      if (quantity > item.stock) {
        return `Only ${item.stock} left in stock for this size / colour.`;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.variantId === variantId ? { ...i, quantity } : i,
        ),
      );
      return null;
    },
    [items],
  );

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCouponCode(null);
  }, []);

  const applyCoupon = useCallback(
    (code: string): string => {
      const result = computeTotals(items, code).coupon;
      if (result?.valid) {
        setCouponCode(result.code);
        return result.message;
      }
      return result?.message ?? "This coupon code is not valid.";
    },
    [items],
  );

  const removeCoupon = useCallback(() => setCouponCode(null), []);

  /** Best-effort Supabase wishlist sync for signed-in customers. */
  const syncWishlistToSupabase = useCallback(
    async (nextIds: string[], userId: string) => {
      if (!isSupabaseConfigured()) return;
      try {
        const supabase = createClient();
        // Replace the server wishlist with the local list (small, simple).
        await supabase.from("wishlist").delete().eq("user_id", userId);
        if (nextIds.length > 0) {
          await supabase.from("wishlist").insert(
            nextIds.map((productId) => ({
              user_id: userId,
              product_id: productId,
            })),
          );
        }
      } catch {
        // Sync failure must never break the local wishlist.
      }
    },
    [],
  );

  const toggleWishlist = useCallback(
    (productId: string) => {
      setProductIds((prev) => {
        const next = prev.includes(productId)
          ? prev.filter((id) => id !== productId)
          : [...prev, productId];
        // Fire-and-forget sync when signed in.
        if (isSupabaseConfigured()) {
          createClient()
            .auth.getUser()
            .then(({ data }) => {
              if (data.user) void syncWishlistToSupabase(next, data.user.id);
            })
            .catch(() => undefined);
        }
        return next;
      });
    },
    [syncWishlistToSupabase],
  );

  const cartValue = useMemo<CartContextValue>(
    () => ({
      items,
      totals,
      couponCode,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
    }),
    [
      items,
      totals,
      couponCode,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
    ],
  );

  const wishlistValue = useMemo<WishlistContextValue>(
    () => ({
      productIds,
      isWishlisted: (productId: string) => productIds.includes(productId),
      toggleWishlist,
    }),
    [productIds, toggleWishlist],
  );

  return (
    <CartContext.Provider value={cartValue}>
      <WishlistContext.Provider value={wishlistValue}>
        {children}
      </WishlistContext.Provider>
    </CartContext.Provider>
  );
}
