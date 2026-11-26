"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SizeChart } from "@/config/size-guide";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Price } from "@/components/ui/Price";
import {
  findVariant,
  initialSelection,
  sizeStock,
  stockMessage,
  type ProductDetail,
  type StockTone,
} from "@/lib/catalog/product";
import { cn } from "@/lib/cn";
import { MAX_QTY, addToCart } from "@/lib/stores/cart";
import { SizeGuideButton } from "./SizeGuide";
import { WishlistButton } from "./WishlistButton";

const toneClass: Record<StockTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-sale",
  neutral: "text-muted",
};
const toneDot: Record<StockTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-sale",
  neutral: "bg-stone-strong",
};

/** Keep ?color=&size= in the URL without a server round trip. */
function syncUrl(color: string | null, size: string | null) {
  const url = new URL(window.location.href);
  if (color) url.searchParams.set("color", color);
  else url.searchParams.delete("color");
  if (size) url.searchParams.set("size", size);
  else url.searchParams.delete("size");
  window.history.replaceState(window.history.state, "", url);
}

export function ProductPurchase({
  product,
  requested,
  lowStockThreshold,
  sizeChart,
}: {
  product: ProductDetail;
  requested: { color?: string | null; size?: string | null };
  lowStockThreshold: number;
  sizeChart: SizeChart | null;
}) {
  const initial = initialSelection(product, requested);
  const [color, setColor] = useState(initial.color);
  const [size, setSize] = useState(initial.size);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const mainActionsRef = useRef<HTMLDivElement>(null);
  const sizeGroupRef = useRef<HTMLFieldSetElement>(null);
  const colorLegendId = useId();
  const sizeLegendId = useId();

  const variant = findVariant(product, color, size);
  const stock = stockMessage(variant, lowStockThreshold);
  const maxQty = Math.max(1, Math.min(MAX_QTY, variant?.stock ?? MAX_QTY));
  const soldOutEverywhere = product.variants.every((v) => v.stock <= 0);
  const price = variant?.price ?? Math.min(...product.variants.map((v) => v.price), product.basePrice);

  // Show the mobile sticky bar while the main Add-to-bag button is off screen.
  useEffect(() => {
    const target = mainActionsRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting), { threshold: 0 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // Let fixed UI (the WhatsApp button) move up while the bar is visible.
  useEffect(() => {
    if (showSticky) document.body.dataset.stickyBar = "true";
    else delete document.body.dataset.stickyBar;
    return () => {
      delete document.body.dataset.stickyBar;
    };
  }, [showSticky]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const chooseColor = (next: string) => {
    setColor(next);
    // Keep the size only if it exists in the new colour.
    const keep = size && product.variants.some((v) => v.color === next && v.size === size) ? size : product.sizes.length === 1 ? size : null;
    setSize(keep);
    setQuantity(1);
    setError(null);
    syncUrl(next, keep);
  };

  const chooseSize = (next: string) => {
    setSize(next);
    setQuantity(1);
    setError(null);
    syncUrl(color, next);
  };

  const add = () => {
    if (!variant) {
      setError("Please select a size.");
      sizeGroupRef.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus();
      sizeGroupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (variant.stock <= 0) return;
    addToCart(variant.id, quantity, variant.stock);
    setError(null);
    setToast(`Added to your bag: ${product.name} (${variant.color}, ${variant.size}) × ${quantity}`);
  };

  const addLabel = soldOutEverywhere ? "Sold out" : variant && variant.stock <= 0 ? "Sold out in this size" : "Add to bag";
  const addDisabled = soldOutEverywhere || (variant !== null && variant.stock <= 0);

  return (
    <div>
      <Price price={price} compareAt={product.compareAtPrice} size="lg" />
      <p className="mt-1 text-xs text-muted">Delivery charges are shown at checkout.</p>

      {/* Colour */}
      <fieldset className="mt-7" aria-labelledby={colorLegendId}>
        <div className="flex items-baseline gap-2 text-sm">
          <span id={colorLegendId} className="font-semibold">
            Colour:
          </span>
          <span className="text-ink-soft" data-testid="selected-color">
            {color}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {product.colors.map((c) => (
            <label key={c.name} className="relative cursor-pointer" title={c.name}>
              <input
                type="radio"
                name={`color-${product.id}`}
                value={c.name}
                checked={color === c.name}
                onChange={() => chooseColor(c.name)}
                className="peer sr-only"
                aria-label={c.inStock ? c.name : `${c.name} (sold out)`}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "block size-10 rounded-full ring-1 ring-stone-strong ring-offset-[3px] ring-offset-paper transition peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-accent",
                  !c.inStock && "opacity-40",
                )}
                style={{ backgroundColor: c.hex }}
              />
              {!c.inStock ? (
                <span aria-hidden="true" className="absolute top-1/2 left-1/2 h-px w-11 -translate-1/2 -rotate-45 bg-ink/60" />
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Size */}
      <fieldset ref={sizeGroupRef} className="mt-7" aria-labelledby={sizeLegendId} aria-describedby={error ? `${sizeLegendId}-err` : undefined}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-2 text-sm">
            <span id={sizeLegendId} className="font-semibold">
              Size:
            </span>
            <span className="text-ink-soft" data-testid="selected-size">
              {size ?? "Select"}
            </span>
          </div>
          {sizeChart ? <SizeGuideButton chart={sizeChart} /> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {product.sizes.map((s) => {
            const exists = product.variants.some((v) => v.color === color && v.size === s);
            const available = exists && sizeStock(product, color, s) > 0;
            return (
              <label key={s} className={cn("relative", available ? "cursor-pointer" : "cursor-not-allowed")}>
                <input
                  type="radio"
                  name={`size-${product.id}`}
                  value={s}
                  checked={size === s}
                  disabled={!available}
                  onChange={() => chooseSize(s)}
                  className="peer sr-only"
                  aria-label={available ? s : `${s} (sold out)`}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex h-12 min-w-14 items-center justify-center rounded-xs border px-4 text-sm font-medium transition-colors",
                    "peer-checked:border-ink peer-checked:bg-ink peer-checked:text-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                    available ? "border-stone-strong bg-surface hover:border-ink" : "border-stone bg-sand text-muted line-through",
                  )}
                >
                  {s}
                </span>
              </label>
            );
          })}
        </div>
        {error ? (
          <p id={`${sizeLegendId}-err`} role="alert" className="mt-2 text-sm font-medium text-sale">
            {error}
          </p>
        ) : null}
      </fieldset>

      {/* Stock + SKU */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
        <p className={cn("flex items-center gap-2 font-medium", toneClass[stock.tone])} data-testid="stock-message">
          <span aria-hidden="true" className={cn("size-2 rounded-full", toneDot[stock.tone])} />
          {stock.text}
        </p>
        <p className="text-xs text-muted">
          SKU: <span data-testid="sku" className="font-mono text-ink-soft">{variant?.sku ?? "—"}</span>
        </p>
      </div>

      {/* Quantity + actions */}
      <div ref={mainActionsRef} className="mt-6 flex items-stretch gap-2 sm:gap-3">
        <div className="flex h-13 shrink-0 items-center rounded-xs border border-stone-strong bg-surface" role="group" aria-label="Quantity">
          <button
            type="button"
            className="inline-flex h-12 w-10 items-center justify-center text-lg disabled:text-stone-strong sm:w-12"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <output className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite" aria-label="Quantity">
            {quantity}
          </output>
          <button
            type="button"
            className="inline-flex h-12 w-10 items-center justify-center text-lg disabled:text-stone-strong sm:w-12"
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            disabled={quantity >= maxQty || !variant}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <Button size="lg" className="min-w-0 flex-1 px-4 sm:px-8" onClick={add} disabled={addDisabled}>
          <Icon name="bag" className="size-5" />
          {addLabel}
        </Button>
        <WishlistButton productId={product.id} productName={product.name} variantId={variant?.id ?? null} variant="inline" />
      </div>

      {/* Toast */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 top-20 z-50 flex justify-center sm:inset-x-auto sm:right-6">
        {toast ? (
          <p className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-card bg-ink px-4 py-3 text-sm text-surface shadow-lift">
            <Icon name="bag" className="mt-0.5 size-4 shrink-0" />
            {toast}
          </p>
        ) : null}
      </div>

      {/* Mobile sticky bar */}
      <div
        data-testid="sticky-add-to-bag"
        aria-hidden={!showSticky}
        inert={!showSticky}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-stone bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 lg:hidden",
          showSticky ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="text-xs text-muted">
              {[color, size].filter(Boolean).join(" · ") || "Choose colour and size"}
            </p>
          </div>
          <Button onClick={add} disabled={addDisabled} className="h-12 shrink-0 px-5">
            {variant ? addLabel : "Select size"}
          </Button>
        </div>
      </div>
    </div>
  );
}
