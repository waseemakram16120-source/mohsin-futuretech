"use client";

import { useSyncExternalStore } from "react";
import { z } from "@/lib/z";
import { storeConfig } from "@/config/store";
import { createLocalStore } from "./local-store";

/**
 * Shopping bag kept in the browser. Only variant ids and quantities are
 * stored — prices and stock are always re-read from the database (and
 * re-checked by place_order at checkout), so a tampered bag cannot change
 * what anyone pays.
 */
export const MAX_QTY: number = storeConfig.cart.maxQuantityPerLine;
export const MAX_LINES = 50;

const lineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_QTY),
});
export type CartLine = z.infer<typeof lineSchema>;

const cartSchema = z.array(lineSchema).max(MAX_LINES);

export const cartStore = createLocalStore<CartLine[]>("mft.cart.v1", cartSchema, []);

/** Pure: add (merging with an existing line, capped at MAX_QTY and stock). */
export function addLine(lines: CartLine[], variantId: string, quantity: number, maxStock = MAX_QTY): CartLine[] {
  const cap = Math.max(0, Math.min(MAX_QTY, maxStock));
  const existing = lines.find((l) => l.variantId === variantId);
  if (existing) {
    return lines.map((l) =>
      l.variantId === variantId ? { ...l, quantity: Math.max(1, Math.min(cap, l.quantity + quantity)) } : l,
    );
  }
  if (lines.length >= MAX_LINES || cap < 1) return lines;
  return [...lines, { variantId, quantity: Math.max(1, Math.min(cap, quantity)) }];
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function addToCart(variantId: string, quantity: number, maxStock?: number) {
  cartStore.set((lines) => addLine(lines, variantId, quantity, maxStock));
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(cartStore.subscribe, cartStore.get, cartStore.getServerSnapshot);
}

/** Pure: set a line's quantity (removes the line at 0). */
export function setLineQuantity(lines: CartLine[], variantId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => l.variantId !== variantId);
  return lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(MAX_QTY, Math.floor(quantity)) } : l));
}

export function updateCartQuantity(variantId: string, quantity: number) {
  cartStore.set((lines) => setLineQuantity(lines, variantId, quantity));
}

export function removeFromCart(variantId: string) {
  cartStore.set((lines) => lines.filter((l) => l.variantId !== variantId));
}

export function clearCart() {
  cartStore.set(() => []);
}
