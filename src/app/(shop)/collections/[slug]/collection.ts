import { getCategoryBySlug, type ListingScope } from "@/lib/catalog/queries";

export interface Collection {
  title: string;
  eyebrow?: string;
  description: string | null;
  scope: ListingScope;
}

const AUDIENCES: Record<string, Collection> = {
  men: {
    eyebrow: "Menswear",
    title: "Men",
    description: "Jackets, denim, shirts, trousers and accessories for men.",
    scope: { audience: "men" },
  },
  women: {
    eyebrow: "Womenswear",
    title: "Women",
    description: "Jackets, denim, shirts, trousers and accessories for women.",
    scope: { audience: "women" },
  },
};

/** Men / Women audiences, or a live category; null when unknown. */
export async function resolveCollection(slug: string): Promise<Collection | null> {
  if (Object.hasOwn(AUDIENCES, slug)) return AUDIENCES[slug];
  const category = await getCategoryBySlug(slug);
  if (!category) return null;
  return { title: category.name, eyebrow: "Collection", description: category.description, scope: { categorySlug: category.slug } };
}
