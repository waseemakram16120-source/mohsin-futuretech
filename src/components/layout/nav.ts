import type { Category } from "@/lib/catalog/mappers";

export interface NavLink {
  label: string;
  href: string;
  emphasis?: "sale";
}

/** Primary navigation: audiences first, then live categories, then Sale. */
export function buildPrimaryNav(categories: Category[]): NavLink[] {
  return [
    { label: "New In", href: "/new-arrivals" },
    { label: "Men", href: "/collections/men" },
    { label: "Women", href: "/collections/women" },
    ...categories.map((c) => ({ label: c.name, href: `/collections/${c.slug}` })),
    { label: "Sale", href: "/sale", emphasis: "sale" as const },
  ];
}

export const HELP_LINKS: NavLink[] = [
  { label: "Track your order", href: "/track" },
  { label: "Shipping & returns", href: "/shipping-returns" },
  { label: "Size guide", href: "/size-guide" },
  { label: "Contact us", href: "/contact" },
];

export const LEGAL_LINKS: NavLink[] = [
  { label: "Privacy policy", href: "/privacy" },
  { label: "Terms of service", href: "/terms" },
];
