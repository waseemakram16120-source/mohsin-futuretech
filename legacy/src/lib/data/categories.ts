/**
 * Storefront categories — mirrors supabase/seed.sql exactly (same names,
 * slugs, descriptions and order). Images are stable Unsplash photos.
 * Used as the fallback when Supabase is not configured, and to fill in
 * category images when a Supabase category row has no image_url yet.
 */

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  sortOrder: number;
}

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70`;

export const LOCAL_CATEGORIES: StoreCategory[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    name: "Men",
    slug: "men",
    description: "Men's clothing — shirts, jeans, trousers and more.",
    image: img("1617137968427-85924c800a22"),
    sortOrder: 1,
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    name: "Women",
    slug: "women",
    description: "Women's clothing — jeans, shirts and seasonal picks.",
    image: img("1483985988355-763728e1935b"),
    sortOrder: 2,
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    name: "Jackets",
    slug: "jackets",
    description: "Denim, biker and casual jackets for every season.",
    image: img("1551028719-00167b16eac5"),
    sortOrder: 3,
  },
  {
    id: "a0000000-0000-4000-8000-000000000004",
    name: "Jeans",
    slug: "jeans",
    description: "Classic, slim-fit and skinny jeans in every wash.",
    image: img("1542272604-787c3835535d"),
    sortOrder: 4,
  },
  {
    id: "a0000000-0000-4000-8000-000000000005",
    name: "Shirts",
    slug: "shirts",
    description: "Oxford, checked, lawn and casual shirts.",
    image: img("1596755094514-f87e34085b2c"),
    sortOrder: 5,
  },
  {
    id: "a0000000-0000-4000-8000-000000000006",
    name: "Trousers",
    slug: "trousers",
    description: "Chinos and formal dress trousers.",
    image: img("1594938298603-c8148c4dae35"),
    sortOrder: 6,
  },
  {
    id: "a0000000-0000-4000-8000-000000000007",
    name: "Accessories",
    slug: "accessories",
    description: "Belts, wallets and everyday essentials.",
    image: img("1624222247344-550fb60583dc"),
    sortOrder: 7,
  },
];

export function getLocalCategory(slug: string): StoreCategory | undefined {
  return LOCAL_CATEGORIES.find((c) => c.slug === slug);
}
