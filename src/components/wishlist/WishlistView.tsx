"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import type { ProductCardData } from "@/lib/catalog/mappers";
import { useWishlist } from "@/lib/stores/wishlist";

const noopSubscribe = () => () => {};

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; products: ProductCardData[]; key: string };

export function WishlistView() {
  const entries = useWishlist();
  const ids = entries.map((e) => e.productId);
  const key = ids.join(",");
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // false during SSR/hydration (the saved list lives in localStorage).
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (!hydrated || !key) return;
    // Removing an item needs no refetch: the list is filtered below.
    if (state.status === "ready" && key.split(",").every((id) => state.key.split(",").includes(id))) return;
    const controller = new AbortController();
    fetch(`/api/products?ids=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { products: ProductCardData[] }) => setState({ status: "ready", products: body.products, key }))
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") setState({ status: "error" });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the id set or attempt changes
  }, [hydrated, key, attempt]);

  if (!hydrated || (key && state.status === "loading")) {
    return (
      <div role="status" aria-live="polite" className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        <span className="sr-only">Loading your wishlist…</span>
        {Array.from({ length: Math.min(Math.max(ids.length, 4), 8) }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!key) {
    return (
      <EmptyState
        icon="heart"
        title="Your wishlist is empty"
        description="Tap the heart on any product to save it here for later."
        action={<ButtonLink href="/new-arrivals">Discover new arrivals</ButtonLink>}
      />
    );
  }

  if (state.status === "error") {
    return (
      <ErrorState
        title="We couldn't load your wishlist"
        description="Your saved items are safe. Please check your connection and try again."
        action={
          <Button
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }

  const products = state.status === "ready" ? state.products.filter((p) => ids.includes(p.id)) : [];
  const unavailable = ids.length - products.length;

  return (
    <div>
      <p className="text-sm text-ink-soft" aria-live="polite">
        {products.length} saved {products.length === 1 ? "item" : "items"}
        {unavailable > 0 ? ` · ${unavailable} no longer available` : ""}
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4" data-testid="wishlist-grid">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} headingLevel={2} />
          </li>
        ))}
      </ul>
    </div>
  );
}
