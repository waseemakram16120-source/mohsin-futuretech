"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
  { href: "/wishlist", label: "Wishlist" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account">
      <ul className="flex flex-wrap gap-1 lg:flex-col">
        {LINKS.map((l) => {
          const active = l.href === "/account" ? pathname === "/account" : pathname.startsWith(l.href);
          return (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center rounded-xs px-4 text-sm font-medium transition-colors",
                  active ? "bg-ink text-surface" : "text-ink-soft hover:bg-sand hover:text-ink",
                )}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-4 lg:border-t lg:border-stone lg:pt-4">
          <form action={signOut}>
            <button type="submit" className="flex h-11 items-center whitespace-nowrap rounded-xs px-4 text-sm font-medium text-ink-soft hover:bg-sand hover:text-ink lg:w-full">
              Sign out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
