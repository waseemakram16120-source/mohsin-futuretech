"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  SORT_OPTIONS,
  type ShopFilters,
  type SortOption,
} from "@/lib/data/catalog";
import type { StoreCategory } from "@/lib/data/categories";

/**
 * Shop filters — every change updates the URL search params (?category=
 * &min=&max=&size=&color=&in_stock=1&sale=1&sort=) so filtered views are
 * shareable and the server re-renders the matching products.
 */
export default function ShopFilters({
  categories,
  sizes,
  colors,
  filters,
  priceBounds,
  basePath,
}: {
  categories: StoreCategory[];
  sizes: string[];
  colors: string[];
  filters: ShopFilters;
  priceBounds: { min: number; max: number };
  /** e.g. "/shop", "/category/jeans", "/search" — filters are applied here. */
  basePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function push(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    push(next);
  }

  function toggleListParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    const current = next.getAll(key);
    next.delete(key);
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updated.forEach((v) => next.append(key, v));
    push(next);
  }

  function toggleFlag(key: string, on: boolean) {
    const next = new URLSearchParams(searchParams.toString());
    if (on) next.set(key, "1");
    else next.delete(key);
    push(next);
  }

  const hasActiveFilters =
    filters.category !== "" ||
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.sizes.length > 0 ||
    filters.colors.length > 0 ||
    filters.inStock ||
    filters.onSale;

  function clearAll() {
    const next = new URLSearchParams(searchParams.toString());
    for (const key of ["category", "min", "max", "size", "color", "in_stock", "sale"]) {
      next.delete(key);
    }
    push(next);
  }

  return (
    <aside className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-zinc-900">Filters</h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Sort */}
      <div className="mt-4">
        <label
          htmlFor="sort-select"
          className="text-xs font-bold tracking-wide text-zinc-500 uppercase"
        >
          Sort by
        </label>
        <select
          id="sort-select"
          value={filters.sort}
          onChange={(e) => setParam("sort", e.target.value as SortOption)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0f2440]"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div className="mt-5">
        <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
          Category
        </p>
        <ul className="mt-2 space-y-1">
          <li>
            <button
              type="button"
              onClick={() => setParam("category", null)}
              className={`w-full rounded-lg px-3 py-1.5 text-left text-sm ${
                filters.category === ""
                  ? "bg-[#0f2440] font-semibold text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              All Categories
            </button>
          </li>
          {categories.map((category) => (
            <li key={category.slug}>
              <button
                type="button"
                onClick={() => setParam("category", category.slug)}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-sm ${
                  filters.category === category.slug
                    ? "bg-[#0f2440] font-semibold text-white"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Price range */}
      <div className="mt-5">
        <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
          Price (Rs)
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={priceBounds.min}
            max={priceBounds.max}
            placeholder={`Min ${priceBounds.min}`}
            defaultValue={filters.minPrice ?? ""}
            key={`min-${filters.minPrice ?? ""}`}
            onBlur={(e) => setParam("min", e.target.value || null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam("min", e.currentTarget.value || null);
            }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0f2440]"
            aria-label="Minimum price"
          />
          <span className="text-zinc-400">–</span>
          <input
            type="number"
            min={priceBounds.min}
            max={priceBounds.max}
            placeholder={`Max ${priceBounds.max}`}
            defaultValue={filters.maxPrice ?? ""}
            key={`max-${filters.maxPrice ?? ""}`}
            onBlur={(e) => setParam("max", e.target.value || null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam("max", e.currentTarget.value || null);
            }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0f2440]"
            aria-label="Maximum price"
          />
        </div>
      </div>

      {/* Sizes */}
      <div className="mt-5">
        <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
          Size
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {sizes.map((size) => {
            const active = filters.sizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => toggleListParam("size", size)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "border-[#0f2440] bg-[#0f2440] text-white"
                    : "border-zinc-300 text-zinc-700 hover:border-[#0f2440]"
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>

      {/* Colours */}
      <div className="mt-5">
        <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
          Colour
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {colors.map((color) => {
            const active = filters.colors.includes(color);
            return (
              <button
                key={color}
                type="button"
                onClick={() => toggleListParam("color", color)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "border-[#0f2440] bg-[#0f2440] text-white"
                    : "border-zinc-300 text-zinc-700 hover:border-[#0f2440]"
                }`}
              >
                {color}
              </button>
            );
          })}
        </div>
      </div>

      {/* Checkboxes */}
      <div className="mt-5 space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={filters.inStock}
            onChange={(e) => toggleFlag("in_stock", e.target.checked)}
            className="h-4 w-4 accent-[#0f2440]"
          />
          In stock only
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={filters.onSale}
            onChange={(e) => toggleFlag("sale", e.target.checked)}
            className="h-4 w-4 accent-[#0f2440]"
          />
          On sale only
        </label>
      </div>
    </aside>
  );
}
