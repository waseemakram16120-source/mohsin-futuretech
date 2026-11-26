"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Quote } from "@/lib/orders/quote";
import { useCart } from "@/lib/stores/cart";
import { useCouponCode } from "@/lib/stores/coupon";

export type QuoteState =
  | { status: "loading"; quote: Quote | null }
  | { status: "ready"; quote: Quote }
  | { status: "error"; quote: Quote | null; message: string };

const noopSubscribe = () => () => {};

/**
 * Live quote for the bag in localStorage. Refetches (debounced) whenever the
 * bag or coupon changes; keeps showing the last quote while loading so the
 * page does not flash.
 */
export function useQuote() {
  const lines = useCart();
  const coupon = useCouponCode();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [state, setState] = useState<QuoteState>({ status: "loading", quote: null });
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([lines, coupon]);

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState((s) => ({ status: "loading", quote: s.quote }));
      fetch("/api/cart/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines, couponCode: coupon ?? "" }),
        signal: controller.signal,
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error ?? "We couldn't load your bag. Please try again.");
          setState({ status: "ready", quote: body as Quote });
        })
        .catch((error: Error) => {
          if (error.name === "AbortError") return;
          setState((s) => ({ status: "error", quote: s.quote, message: error.message }));
        });
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures lines + coupon
  }, [hydrated, key, attempt]);

  return { state, lines, coupon, hydrated, retry: () => setAttempt((a) => a + 1) };
}
