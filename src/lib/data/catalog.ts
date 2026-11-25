/**
 * Client-safe catalogue helpers — pure functions over StoreProduct, with
 * no server-only imports. Imported by both Server Components and the
 * client-side ShopFilters. (The Supabase data fetching lives in
 * src/lib/data/store.ts, which is server-only.)
 */
import type { StoreProduct } from "./products";

export type SortOption =
  | "featured"
  | "price-asc"
  | "price-desc"
  | "newest"
  | "name-asc";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
  { value: "name-asc", label: "Name: A to Z" },
];

export interface ShopFilters {
  q: string;
  category: string;
  minPrice: number | null;
  maxPrice: number | null;
  sizes: string[];
  colors: string[];
  inStock: boolean;
  onSale: boolean;
  sort: SortOption;
}

/** Parse ?q=&category=&min=&max=&size=&color=&in_stock=1&sale=1&sort= params. */
export function parseShopFilters(
  params: Record<string, string | string[] | undefined>,
): ShopFilters {
  const first = (v: string | string[] | undefined): string =>
    Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  const list = (v: string | string[] | undefined): string[] =>
    Array.isArray(v) ? v : v ? [v] : [];
  const num = (v: string | string[] | undefined): number | null => {
    const n = Number(first(v));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const sortRaw = first(params.sort);
  const sort: SortOption = (
    ["featured", "price-asc", "price-desc", "newest", "name-asc"] as const
  ).includes(sortRaw as SortOption)
    ? (sortRaw as SortOption)
    : "featured";
  return {
    q: first(params.q),
    category: first(params.category),
    minPrice: num(params.min),
    maxPrice: num(params.max),
    sizes: list(params.size),
    colors: list(params.color),
    inStock: first(params.in_stock) === "1",
    onSale: first(params.sale) === "1",
    sort,
  };
}

/**
 * Does a product belong to a category slug? Gender categories (men / women)
 * also match by the product name prefix ("Men's …" / "Women's …"), because
 * the catalogue mixes gender and garment-type categories and each product
 * has a single category — e.g. a men's shirt lives in "shirts", not "men".
 * Garment categories match by categorySlug only.
 */
export function matchesCategory(
  product: StoreProduct,
  slug: string,
): boolean {
  if (slug === "men") {
    return (
      product.categorySlug === "men" ||
      product.name.toLowerCase().startsWith("men's")
    );
  }
  if (slug === "women") {
    return (
      product.categorySlug === "women" ||
      product.name.toLowerCase().startsWith("women's")
    );
  }
  return product.categorySlug === slug;
}

export function applyFilters(
  products: StoreProduct[],
  filters: ShopFilters,
): StoreProduct[] {
  let list = [...products];
  if (filters.category) {
    list = list.filter((p) => matchesCategory(p, filters.category));
  }
  if (filters.q) {
    const q = filters.q.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q),
    );
  }
  if (filters.minPrice !== null) {
    list = list.filter((p) => p.price >= (filters.minPrice as number));
  }
  if (filters.maxPrice !== null) {
    list = list.filter((p) => p.price <= (filters.maxPrice as number));
  }
  if (filters.sizes.length > 0) {
    list = list.filter((p) =>
      p.variants.some((v) => filters.sizes.includes(v.size)),
    );
  }
  if (filters.colors.length > 0) {
    list = list.filter((p) =>
      p.variants.some((v) => filters.colors.includes(v.color)),
    );
  }
  if (filters.inStock) {
    list = list.filter((p) => p.variants.some((v) => v.stock > 0));
  }
  if (filters.onSale) {
    list = list.filter(
      (p) => p.compareAtPrice !== null && p.compareAtPrice > p.price,
    );
  }
  return sortProducts(list, filters.sort);
}

export function sortProducts(
  products: StoreProduct[],
  sort: SortOption,
): StoreProduct[] {
  const list = [...products];
  switch (sort) {
    case "price-asc":
      return list.sort((a, b) => a.price - b.price);
    case "price-desc":
      return list.sort((a, b) => b.price - a.price);
    case "newest":
      return list.sort((a, b) => Number(b.isNew) - Number(a.isNew));
    case "name-asc":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "featured":
    default:
      return list.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  }
}

/** All sizes / colours present in the catalogue (for filter options). */
export function allSizes(products: StoreProduct[]): string[] {
  const order = ["S", "M", "L", "XL", "28", "30", "32", "34", "36", "One Size"];
  const sizes = [
    ...new Set(products.flatMap((p) => p.variants.map((v) => v.size))),
  ];
  return sizes.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export function allColors(products: StoreProduct[]): string[] {
  return [
    ...new Set(products.flatMap((p) => p.variants.map((v) => v.color))),
  ].sort();
}
