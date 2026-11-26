import type { ProductCardData, ProductRow } from "@/lib/catalog/mappers";

export function productRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "mens-slim-fit-stretch-jeans",
    name: "Men's Slim Fit Stretch Jeans",
    audience: "men",
    base_price: "4499.00",
    compare_at_price: null,
    is_featured: true,
    is_new_arrival: false,
    created_at: "2026-11-26T00:00:00Z",
    category: { name: "Jeans", slug: "jeans" },
    product_images: [
      { url: "/placeholders/b.svg", alt: "Back", sort_order: 1 },
      { url: "/placeholders/a.svg", alt: "Front", sort_order: 0 },
    ],
    product_variants: [
      { size: "32", color: "Indigo", color_hex: "#2E3F6E", stock_quantity: 0, price_override: null, sort_order: 1 },
      { size: "30", color: "Indigo", color_hex: "#2E3F6E", stock_quantity: 4, price_override: null, sort_order: 0 },
      { size: "30", color: "Black", color_hex: "#1F1F1F", stock_quantity: 2, price_override: null, sort_order: 100 },
    ],
    ...overrides,
  };
}

export function productCard(overrides: Partial<ProductCardData> = {}): ProductCardData {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "mens-quilted-puffer-jacket",
    name: "Men's Quilted Puffer Jacket",
    audience: "men",
    categoryName: "Jackets",
    categorySlug: "jackets",
    price: 7999,
    priceVaries: false,
    compareAtPrice: null,
    image: { url: "/placeholders/front.svg", alt: "Men's Quilted Puffer Jacket" },
    hoverImage: { url: "/placeholders/back.svg", alt: "Back" },
    isNew: false,
    isFeatured: true,
    inStock: true,
    sizesInStock: ["S", "M"],
    colors: [
      { name: "Black", hex: "#1F1F1F" },
      { name: "Olive", hex: "#5B6236" },
    ],
    ...overrides,
  };
}
