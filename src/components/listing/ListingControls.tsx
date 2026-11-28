"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Facets } from "@/lib/catalog/queries";
import {
  SORT_OPTIONS,
  activeChips,
  clearFilters,
  filtersToSearch,
  hasActiveFilters,
  toggle,
  updateFilters,
  type ListingFilters,
  type SortValue,
} from "@/lib/catalog/filters";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

/* ------------------------------- context --------------------------------- */

interface ListingContextValue {
  filters: ListingFilters;
  defaultSort: SortValue;
  pending: boolean;
  apply: (next: ListingFilters) => void;
}

const ListingContext = createContext<ListingContextValue | null>(null);

function useListing() {
  const ctx = useContext(ListingContext);
  if (!ctx) throw new Error("Listing controls must be inside <ListingProvider>");
  return ctx;
}

/**
 * Holds the current (URL) filters and navigates on change. Filters are the
 * URL: every change is a router.push, so Back/Forward and sharing work.
 */
export function ListingProvider({
  filters,
  defaultSort,
  children,
}: {
  filters: ListingFilters;
  defaultSort: SortValue;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // Controls reflect a click immediately while the new results load.
  const [optimistic, setOptimistic] = useOptimistic(filters);

  const apply = useCallback(
    (next: ListingFilters) => {
      startTransition(() => {
        setOptimistic(next);
        router.push(`${pathname}${filtersToSearch(next, defaultSort)}`, { scroll: false });
      });
    },
    [router, pathname, defaultSort, setOptimistic],
  );

  return (
    <ListingContext.Provider value={{ filters: optimistic, defaultSort, pending, apply }}>{children}</ListingContext.Provider>
  );
}

/** Dims the results and announces "Updating…" while new results load. */
export function ResultsRegion({ children }: { children: ReactNode }) {
  const { pending } = useListing();
  return (
    <div aria-busy={pending} className={cn("transition-opacity duration-200", pending && "pointer-events-none opacity-50")}>
      <p role="status" className="sr-only">
        {pending ? "Updating results…" : ""}
      </p>
      {children}
    </div>
  );
}

/* --------------------------------- sort ---------------------------------- */

export function SortSelect({ allowRelevance = false }: { allowRelevance?: boolean }) {
  const { filters, apply } = useListing();
  const id = useId();
  const options = SORT_OPTIONS.filter((o) => allowRelevance || o.value !== "relevance");
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted">
        Sort by
      </label>
      <div className="relative">
        <select
          id={id}
          value={filters.sort}
          onChange={(e) => apply(updateFilters(filters, { sort: e.target.value as SortValue }))}
          className="h-10 appearance-none rounded-xs border border-stone-strong bg-surface py-0 pr-9 pl-3 text-sm font-medium"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2" />
      </div>
    </div>
  );
}

/* ------------------------------ active chips ----------------------------- */

export function ActiveFilterChips({ lockedSale = false }: { lockedSale?: boolean }) {
  const { filters, apply } = useListing();
  const chips = activeChips(filters, formatPrice).filter((c) => !(lockedSale && c.key === "sale"));
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters" role="group">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => apply(chip.next)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-strong bg-surface pr-2.5 pl-3 text-xs font-medium hover:border-ink"
          aria-label={`Remove filter: ${chip.label}`}
        >
          {chip.label}
          <Icon name="close" className="size-3.5" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => apply(clearFilters(filters))}
        className="h-8 px-2 text-xs font-medium text-ink-soft underline underline-offset-4 hover:text-ink"
      >
        Clear all
      </button>
    </div>
  );
}

/* ------------------------------ filter panel ----------------------------- */

function FilterGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-stone py-5 first:pt-0">
      <legend className="float-left mb-3 w-full text-sm font-semibold">{legend}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

const chipBox =
  "inline-flex min-h-10 min-w-11 cursor-pointer items-center justify-center rounded-xs border border-stone-strong bg-surface px-3 text-sm transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent hover:border-ink";

export function FilterPanel({ facets, lockedSale = false }: { facets: Facets; lockedSale?: boolean }) {
  const { filters, apply } = useListing();
  const minId = useId();
  const maxId = useId();

  const onPrice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: string) => {
      const raw = String(data.get(key) ?? "").replace(/[^\d]/g, "");
      return raw ? Number(raw) : null;
    };
    let min = read("min");
    let max = read("max");
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    apply(updateFilters(filters, { min, max }));
  };

  return (
    <div>
      {facets.sizes.length > 0 ? (
        <FilterGroup legend="Size">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((size) => (
              <label key={size}>
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={filters.sizes.includes(size)}
                  onChange={() => apply(updateFilters(filters, { sizes: toggle(filters.sizes, size) }))}
                />
                <span className={chipBox}>{size}</span>
              </label>
            ))}
          </div>
        </FilterGroup>
      ) : null}

      {facets.colors.length > 0 ? (
        <FilterGroup legend="Colour">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {facets.colors.map((color) => (
              <label key={color.name} className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={filters.colors.includes(color.name)}
                  onChange={() => apply(updateFilters(filters, { colors: toggle(filters.colors, color.name) }))}
                />
                <span
                  aria-hidden="true"
                  className="size-5 shrink-0 rounded-full ring-1 ring-stone-strong ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-accent"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="peer-checked:font-semibold">{color.name}</span>
              </label>
            ))}
          </div>
        </FilterGroup>
      ) : null}

      <FilterGroup legend="Price (Rs)">
        <form onSubmit={onPrice} className="flex items-end gap-2" key={`${filters.min}-${filters.max}`}>
          <div className="min-w-0 flex-1">
            <label htmlFor={minId} className="text-xs text-muted">
              Min
            </label>
            <input
              id={minId}
              name="min"
              inputMode="numeric"
              placeholder={facets.minPrice !== null ? String(Math.floor(facets.minPrice)) : "0"}
              defaultValue={filters.min ?? ""}
              className="mt-1 h-10 w-full rounded-xs border border-stone-strong bg-surface px-3 text-sm"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor={maxId} className="text-xs text-muted">
              Max
            </label>
            <input
              id={maxId}
              name="max"
              inputMode="numeric"
              placeholder={facets.maxPrice !== null ? String(Math.ceil(facets.maxPrice)) : ""}
              defaultValue={filters.max ?? ""}
              className="mt-1 h-10 w-full rounded-xs border border-stone-strong bg-surface px-3 text-sm"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="h-10">
            Apply
          </Button>
        </form>
      </FilterGroup>

      <FilterGroup legend="Availability">
        <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-4.5 accent-ink"
            checked={filters.inStock}
            onChange={(e) => apply(updateFilters(filters, { inStock: e.target.checked }))}
          />
          In stock only
        </label>
        {!lockedSale ? (
          <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-4.5 accent-ink"
              checked={filters.onSale}
              onChange={(e) => apply(updateFilters(filters, { onSale: e.target.checked }))}
            />
            On sale
          </label>
        ) : null}
      </FilterGroup>
    </div>
  );
}

/* --------------------------- mobile filter sheet ------------------------- */

const noopSubscribe = () => () => {};

export function MobileFilterSheet({
  facets,
  total,
  lockedSale = false,
  allowRelevance = false,
}: {
  facets: Facets;
  total: number;
  lockedSale?: boolean;
  allowRelevance?: boolean;
}) {
  const { filters, apply, pending } = useListing();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const activeCount = activeChips(filters, formatPrice).filter((c) => !(lockedSale && c.key === "sale")).length;
  // The dialog is portalled to <body> (see MobileMenu for why); false
  // during SSR/hydration.
  const portalReady = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, portalReady]);

  const sheet = (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false); // backdrop click
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88dvh] w-full max-w-none rounded-t-xl bg-surface p-0 text-ink backdrop:bg-ink/40 lg:hidden"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-stone px-4">
          <h2 id={titleId} className="font-display text-xl">
            Filter &amp; sort
          </h2>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-xs hover:bg-sand"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" className="size-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mb-5 border-b border-stone pb-5">
            <SortSelect allowRelevance={allowRelevance} />
          </div>
          <FilterPanel facets={facets} lockedSale={lockedSale} />
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-stone p-4">
          <Button variant="secondary" onClick={() => apply(clearFilters(filters))} disabled={!hasActiveFilters(filters)}>
            Clear all
          </Button>
          <Button onClick={() => setOpen(false)} aria-live="polite">
            {pending ? "Updating…" : `Show ${total} ${total === 1 ? "result" : "results"}`}
          </Button>
        </div>
      </div>
    </dialog>
  );

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="h-10 lg:hidden"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
        Filter &amp; sort{activeCount ? ` (${activeCount})` : ""}
      </Button>
      {portalReady ? createPortal(sheet, document.body) : null}
    </>
  );
}
