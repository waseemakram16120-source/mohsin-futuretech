"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { createLocalStore } from "./local-store";

/** The coupon code the shopper applied in the bag (validated server-side). */
export const couponStore = createLocalStore<string | null>(
  "mft.coupon.v1",
  z.string().regex(/^[A-Z0-9]{1,30}$/).nullable(),
  null,
);

export function useCouponCode(): string | null {
  return useSyncExternalStore(couponStore.subscribe, couponStore.get, couponStore.getServerSnapshot);
}

export function setCouponCode(code: string | null) {
  couponStore.set(() => code);
}
