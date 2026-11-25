/**
 * Storefront product catalogue — mirrors supabase/seed.sql exactly:
 * same 12 products, same names, slugs, descriptions, PKR prices,
 * compare-at prices, featured / new flags, and the same size / colour /
 * stock / SKU variants. Images are stable Unsplash photos (all verified
 * HTTP 200 before use). Used as the fallback when Supabase is not
 * configured; the Supabase rows carry the same data once seeded.
 */

export interface StoreVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  stock: number;
}

export interface StoreProduct {
  id: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  images: string[];
  isFeatured: boolean;
  isNew: boolean;
  variants: StoreVariant[];
}

export const COLOR_HEX: Record<string, string> = {
  Blue: "#2563eb",
  Black: "#171717",
  White: "#f8fafc",
  Red: "#dc2626",
  Green: "#16a34a",
  Pink: "#ec4899",
  Khaki: "#c3b091",
  Navy: "#0f2440",
  Grey: "#9ca3af",
  Brown: "#92400e",
};

const img = (id: string, w = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

function v(
  productSlug: string,
  sku: string,
  size: string,
  color: string,
  stock: number,
): StoreVariant {
  return {
    id: `${productSlug}-${sku}`,
    sku,
    size,
    color,
    colorHex: COLOR_HEX[color] ?? "#6b7280",
    stock,
  };
}

export const LOCAL_PRODUCTS: StoreProduct[] = [
  {
    id: "b0000000-0000-4000-8000-000000000001",
    categoryId: "a0000000-0000-4000-8000-000000000004",
    categorySlug: "jeans",
    categoryName: "Jeans",
    name: "Men's Classic Blue Jeans",
    slug: "mens-classic-blue-jeans",
    description:
      "Mid-rise straight-fit jeans in a classic stonewash blue. Durable everyday denim.",
    price: 3499,
    compareAtPrice: 4499,
    images: [
      img("1542272604-787c3835535d"),
      img("1541099649105-f69ad21f3246"),
      img("1475178626620-a4d074967452"),
    ],
    isFeatured: true,
    isNew: false,
    variants: [
      v("mens-classic-blue-jeans", "MF-JN-001-BLU-30", "30", "Blue", 18),
      v("mens-classic-blue-jeans", "MF-JN-001-BLU-32", "32", "Blue", 24),
      v("mens-classic-blue-jeans", "MF-JN-001-BLU-34", "34", "Blue", 20),
      v("mens-classic-blue-jeans", "MF-JN-001-BLU-36", "36", "Blue", 12),
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000002",
    categoryId: "a0000000-0000-4000-8000-000000000004",
    categorySlug: "jeans",
    categoryName: "Jeans",
    name: "Men's Slim-Fit Black Jeans",
    slug: "mens-slim-fit-black-jeans",
    description:
      "Slim-fit stretch jeans in deep black. Smart, comfortable and easy to pair.",
    price: 3799,
    compareAtPrice: null,
    images: [
      img("1541099649105-f69ad21f3246"),
      img("1475178626620-a4d074967452"),
      img("1542272604-787c3835535d"),
    ],
    isFeatured: true,
    isNew: false,
    variants: [
      v("mens-slim-fit-black-jeans", "MF-JN-002-BLK-30", "30", "Black", 15),
      v("mens-slim-fit-black-jeans", "MF-JN-002-BLK-32", "32", "Black", 22),
      v("mens-slim-fit-black-jeans", "MF-JN-002-BLK-34", "34", "Black", 16),
      v("mens-slim-fit-black-jeans", "MF-JN-002-BLK-36", "36", "Black", 9),
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000003",
    categoryId: "a0000000-0000-4000-8000-000000000004",
    categorySlug: "jeans",
    categoryName: "Jeans",
    name: "Women's High-Waist Skinny Jeans",
    slug: "womens-high-waist-skinny-jeans",
    description:
      "High-waist skinny jeans with stretch comfort and a clean, modern wash.",
    price: 3999,
    compareAtPrice: 4999,
    images: [
      img("1594633312681-425c7b97ccd1"),
      img("1541099649105-f69ad21f3246"),
      img("1475178626620-a4d074967452"),
    ],
    isFeatured: true,
    isNew: true,
    variants: [
      v("womens-high-waist-skinny-jeans", "MF-JN-003-BLU-28", "28", "Blue", 14),
      v("womens-high-waist-skinny-jeans", "MF-JN-003-BLU-30", "30", "Blue", 19),
      v("womens-high-waist-skinny-jeans", "MF-JN-003-BLK-30", "30", "Black", 11),
      v("womens-high-waist-skinny-jeans", "MF-JN-003-BLK-32", "32", "Black", 8),
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000004",
    categoryId: "a0000000-0000-4000-8000-000000000003",
    categorySlug: "jackets",
    categoryName: "Jackets",
    name: "Men's Denim Jacket",
    slug: "mens-denim-jacket",
    description:
      "Classic trucker denim jacket with button front and chest pockets.",
    price: 5999,
    compareAtPrice: 7499,
    images: [
      img("1576995853123-5a10305d93c0"),
      img("1551028719-00167b16eac5"),
      img("1551537482-f2075a1d41f2"),
    ],
    isFeatured: true,
    isNew: false,
    variants: [
      v("mens-denim-jacket", "MF-JK-001-BLU-M", "M", "Blue", 10),
      v("mens-denim-jacket", "MF-JK-001-BLU-L", "L", "Blue", 14),
      v("mens-denim-jacket", "MF-JK-001-BLU-XL", "XL", "Blue", 7),
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000005",
    categoryId: "a0000000-0000-4000-8000-000000000003",
    categorySlug: "jackets",
    categoryName: "Jackets",
    name: "Men's Leather-Style Biker Jacket",
    slug: "mens-biker-jacket",
    description:
      "Leather-style biker jacket with zip front and quilted shoulders.",
    price: 8999,
    compareAtPrice: 10999,
    images: [
      img("1551028719-00167b16eac5"),
      img("1576995853123-5a10305d93c0"),
      img("1551537482-f2075a1d41f2"),
    ],
    isFeatured: false,
    isNew: true,
    variants: [
      v("mens-biker-jacket", "MF-JK-002-BLK-M", "M", "Black", 6),
      v("mens-biker-jacket", "MF-JK-002-BLK-L", "L", "Black", 9),
      v("mens-biker-jacket", "MF-JK-002-BLK-XL", "XL", "Black", 5),
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000006",
    categoryId: "a0000000-0000-4000-8000-000000000005",
    categorySlug: "shirts",
    categoryName: "Shirts",
    name: "Men's Oxford Cotton Shirt",
    slug: "mens-oxford-cotton-shirt",
    description:
      "Breathable Oxford cotton shirt with button-down collar. Office and casual ready.",
    price: 2499,
    compareAtPrice: 2999,
    images: [
      img("1596755094514-f87e34085b2c"),
      img("1602810318383-e386cc2a3ccf"),
      img("1620012253295-c15cc3e65df4"),
    ],
    isFeatured: false,
    isNew: false,
    variants: [
      v("mens-oxford-cotton-shirt", "MF-SH-001-WHT-M", "M", "White", 20),
      v("mens-oxford-cotton-shirt", "MF-SH-001-WHT-L", "L", "White", 18),
      v("mens-oxford-cotton-shirt", "MF-SH-001-BLU-M", "M", "Blue", 16),
      v("mens-oxford-cotton-shirt", "MF-SH-001-BLU-L", "L", "Blue", 13),
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000007",
    categoryId: "a0000000-0000-4000-8000-000000000005",
    categorySlug: "shirts",
    categoryName: "Shirts",
    name: "Men's Checked Casual Shirt",
    slug: "mens-checked-casual-shirt",
    description:
      "Soft checked casual shirt with a relaxed fit and roll-up sleeves.",
    price: 2299,
    compareAtPrice: null,
    images: [
      img("1598033129183-c4f50c736f10"),
      img("1608234807905-4466023792f5"),
      img("1611312449408-fcece27cdbb7"),
    ],
    isFeatured: false,
    isNew: true,
    variants: [
      v("mens-checked-casual-shirt", "MF-SH-002-RED-M", "M", "Red", 17),
      v("mens-checked-casual-shirt", "MF-SH-002-RED-L", "L", "Red", 15),
      v("mens-checked-casual-shirt", "MF-SH-002-GRN-XL", "XL", "Green", 10),
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000008",
    categoryId: "a0000000-0000-4000-8000-000000000005",
    categorySlug: "shirts",
    categoryName: "Shirts",
    name: "Women's Floral Lawn Shirt",
    slug: "womens-floral-lawn-shirt",
    description: "Lightweight floral lawn shirt, perfect for summer days.",
    price: 2799,
    compareAtPrice: 3499,
    images: [
      img("1572804013309-59a88b7e92f1"),
      img("1595777457583-95e059d581b8"),
      img("1483985988355-763728e1935b"),
    ],
    isFeatured: true,
    isNew: true,
    variants: [
      v("womens-floral-lawn-shirt", "MF-SH-003-PNK-S", "S", "Pink", 12),
      v("womens-floral-lawn-shirt", "MF-SH-003-PNK-M", "M", "Pink", 16),
      v("womens-floral-lawn-shirt", "MF-SH-003-PNK-L", "L", "Pink", 9),
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000009",
    categoryId: "a0000000-0000-4000-8000-000000000006",
    categorySlug: "trousers",
    categoryName: "Trousers",
    name: "Men's Chino Trousers",
    slug: "mens-chino-trousers",
    description:
      "Stretch chino trousers with a tapered leg and clean finish.",
    price: 2999,
    compareAtPrice: 3999,
    images: [
      img("1624378439575-d8705ad7ae80"),
      img("1594938298603-c8148c4dae35"),
      img("1473966968600-fa801b869a1a"),
    ],
    isFeatured: false,
    isNew: false,
    variants: [
      v("mens-chino-trousers", "MF-TR-001-KHK-30", "30", "Khaki", 14),
      v("mens-chino-trousers", "MF-TR-001-KHK-32", "32", "Khaki", 18),
      v("mens-chino-trousers", "MF-TR-001-KHK-34", "34", "Khaki", 11),
      v("mens-chino-trousers", "MF-TR-001-NVY-32", "32", "Navy", 10),
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000010",
    categoryId: "a0000000-0000-4000-8000-000000000006",
    categorySlug: "trousers",
    categoryName: "Trousers",
    name: "Men's Formal Dress Trousers",
    slug: "mens-formal-dress-trousers",
    description: "Flat-front formal trousers in wrinkle-resistant fabric.",
    price: 3299,
    compareAtPrice: null,
    images: [
      img("1594938298603-c8148c4dae35"),
      img("1624378439575-d8705ad7ae80"),
      img("1473966968600-fa801b869a1a"),
    ],
    isFeatured: false,
    isNew: false,
    variants: [
      v("mens-formal-dress-trousers", "MF-TR-002-BLK-32", "32", "Black", 13),
      v("mens-formal-dress-trousers", "MF-TR-002-BLK-34", "34", "Black", 12),
      v("mens-formal-dress-trousers", "MF-TR-002-GRY-32", "32", "Grey", 8),
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000011",
    categoryId: "a0000000-0000-4000-8000-000000000001",
    categorySlug: "men",
    categoryName: "Men",
    name: "Men's Pique Polo T-Shirt",
    slug: "mens-pique-polo-tshirt",
    description: "Classic pique polo t-shirt in breathable cotton.",
    price: 1499,
    compareAtPrice: 1999,
    images: [
      img("1576566588028-4147f3842f27"),
      img("1521572163474-6864f9cf17ab"),
      img("1617137968427-85924c800a22"),
    ],
    isFeatured: false,
    isNew: true,
    variants: [
      v("mens-pique-polo-tshirt", "MF-TS-001-WHT-M", "M", "White", 25),
      v("mens-pique-polo-tshirt", "MF-TS-001-WHT-L", "L", "White", 22),
      v("mens-pique-polo-tshirt", "MF-TS-001-NVY-M", "M", "Navy", 19),
      v("mens-pique-polo-tshirt", "MF-TS-001-NVY-L", "L", "Navy", 15),
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000012",
    categoryId: "a0000000-0000-4000-8000-000000000007",
    categorySlug: "accessories",
    categoryName: "Accessories",
    name: "Men's Leather Belt",
    slug: "mens-leather-belt",
    description: "Genuine leather belt with a polished metal buckle.",
    price: 1299,
    compareAtPrice: 1799,
    images: [
      img("1624222247344-550fb60583dc"),
      img("1441986300917-64674bd600d8"),
    ],
    isFeatured: false,
    isNew: false,
    variants: [
      v("mens-leather-belt", "MF-AC-001-BRN-OS", "One Size", "Brown", 30),
      v("mens-leather-belt", "MF-AC-001-BLK-OS", "One Size", "Black", 28),
    ],
  },
];

/** Total stock across all variants of a product. */
export function totalStock(product: StoreProduct): number {
  return product.variants.reduce((sum, variant) => sum + variant.stock, 0);
}

/** Discount percentage vs compare-at price, or 0 when not on sale. */
export function discountPercent(product: StoreProduct): number {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) return 0;
  return Math.round(
    ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100,
  );
}

/** Distinct sizes / colours available for a product. */
export function productSizes(product: StoreProduct): string[] {
  return [...new Set(product.variants.map((variant) => variant.size))];
}

export function productColors(product: StoreProduct): string[] {
  return [...new Set(product.variants.map((variant) => variant.color))];
}

/** "In Stock" / "Low Stock" (5 or fewer left in total) / "Out of Stock". */
export function stockLabel(product: StoreProduct): string {
  const stock = totalStock(product);
  if (stock <= 0) return "Out of Stock";
  if (stock <= 5) return "Low Stock";
  return "In Stock";
}
