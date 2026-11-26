/**
 * Listing filters live in the URL so every filtered view can be shared,
 * bookmarked and navigated with Back/Forward:
 *
 *   ?size=M,L&color=Black,Olive&min=3000&max=8000&stock=1&sale=1&sort=price-asc&page=2&q=jacket
 *
 * Parsing is forgiving: anything invalid is dropped, never thrown, so a
 * hand-edited URL still shows a sensible page. Pure module (unit-tested).
 */
import { z } from "zod";

export const PAGE_SIZE = 24;
const MAX_VALUES = 20;
const MAX_PRICE = 10_000_000;

export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "relevance", label: "Best match" },
] as const;
export type SortValue = (typeof SORT_OPTIONS)[number]["value"];
const SORT_VALUES = SORT_OPTIONS.map((o) => o.value) as [SortValue, ...SortValue[]];

export interface ListingFilters {
  q: string;
  sizes: string[];
  colors: string[];
  min: number | null;
  max: number | null;
  inStock: boolean;
  onSale: boolean;
  sort: SortValue;
  page: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const listSchema = z
  .string()
  .transform((s) =>
    Array.from(
      new Set(
        s
          .split(",")
          .map((x) => x.trim())
          .filter((x) => x.length > 0 && x.length <= 40),
      ),
    ).slice(0, MAX_VALUES),
  );

const priceSchema = z.coerce.number().int().min(0).max(MAX_PRICE);

export function parseFilters(params: RawSearchParams, defaultSort: SortValue = "featured"): ListingFilters {
  const list = (key: string) => {
    const raw = first(params[key]);
    return raw ? listSchema.parse(raw) : [];
  };
  const price = (key: string) => {
    const raw = first(params[key]);
    if (raw === undefined || raw === "") return null;
    const r = priceSchema.safeParse(raw);
    return r.success ? r.data : null;
  };
  const flag = (key: string) => first(params[key]) === "1";

  let min = price("min");
  let max = price("max");
  if (min !== null && max !== null && min > max) [min, max] = [max, min];

  const sortRaw = first(params.sort);
  const sort = z.enum(SORT_VALUES).safeParse(sortRaw);
  const pageRaw = z.coerce.number().int().min(1).max(1000).safeParse(first(params.page));

  return {
    q: (first(params.q) ?? "").trim().slice(0, 100),
    sizes: list("size"),
    colors: list("color"),
    min,
    max,
    inStock: flag("stock"),
    onSale: flag("sale"),
    sort: sort.success ? sort.data : defaultSort,
    page: pageRaw.success ? pageRaw.data : 1,
  };
}

/** Serialise filters back to a query string, omitting defaults. */
export function filtersToSearch(filters: ListingFilters, defaultSort: SortValue = "featured"): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.sizes.length) p.set("size", filters.sizes.join(","));
  if (filters.colors.length) p.set("color", filters.colors.join(","));
  if (filters.min !== null) p.set("min", String(filters.min));
  if (filters.max !== null) p.set("max", String(filters.max));
  if (filters.inStock) p.set("stock", "1");
  if (filters.onSale) p.set("sale", "1");
  if (filters.sort !== defaultSort) p.set("sort", filters.sort);
  if (filters.page > 1) p.set("page", String(filters.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Apply a change; any filter change resets to page 1. */
export function updateFilters(filters: ListingFilters, patch: Partial<ListingFilters>): ListingFilters {
  return { ...filters, page: 1, ...patch };
}

export function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function hasActiveFilters(f: ListingFilters): boolean {
  return f.sizes.length > 0 || f.colors.length > 0 || f.min !== null || f.max !== null || f.inStock || f.onSale;
}

export function clearFilters(f: ListingFilters): ListingFilters {
  return { ...f, sizes: [], colors: [], min: null, max: null, inStock: false, onSale: false, page: 1 };
}

export interface FilterChip {
  key: string;
  label: string;
  next: ListingFilters;
}

/** One removable chip per active filter value. */
export function activeChips(f: ListingFilters, formatPrice: (n: number) => string): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const size of f.sizes) {
    chips.push({ key: `size-${size}`, label: `Size ${size}`, next: updateFilters(f, { sizes: f.sizes.filter((s) => s !== size) }) });
  }
  for (const color of f.colors) {
    chips.push({ key: `color-${color}`, label: color, next: updateFilters(f, { colors: f.colors.filter((c) => c !== color) }) });
  }
  if (f.min !== null || f.max !== null) {
    const label =
      f.min !== null && f.max !== null
        ? `${formatPrice(f.min)} – ${formatPrice(f.max)}`
        : f.min !== null
          ? `From ${formatPrice(f.min)}`
          : `Up to ${formatPrice(f.max as number)}`;
    chips.push({ key: "price", label, next: updateFilters(f, { min: null, max: null }) });
  }
  if (f.inStock) chips.push({ key: "stock", label: "In stock", next: updateFilters(f, { inStock: false }) });
  if (f.onSale) chips.push({ key: "sale", label: "On sale", next: updateFilters(f, { onSale: false }) });
  return chips;
}

const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

/** XS…XXL in order, then numeric sizes ascending, then anything else, One Size last. */
export function sortSizes(sizes: string[]): string[] {
  const rank = (s: string): [number, number, string] => {
    const letter = LETTER_SIZES.indexOf(s.toUpperCase());
    if (letter >= 0) return [0, letter, s];
    if (/^\d+(\.\d+)?$/.test(s)) return [1, Number(s), s];
    if (/one size/i.test(s)) return [3, 0, s];
    return [2, 0, s.toLowerCase()];
  };
  return [...sizes].sort((a, b) => {
    const [ga, na, sa] = rank(a);
    const [gb, nb, sb] = rank(b);
    return ga - gb || na - nb || sa.localeCompare(sb);
  });
}

/** Page numbers to show, with null for gaps: 1 … 4 5 6 … 12 */
export function pageList(current: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}
