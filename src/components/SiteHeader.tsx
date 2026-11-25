"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPKR, FREE_DELIVERY_THRESHOLD, STORE_NAME } from "@/lib/constants";
import type { StoreCategory } from "@/lib/data/categories";
import { useCart, useWishlist } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";

/**
 * Site-wide header: logo, category nav, search box, wishlist / cart with
 * live counts, account / login and order tracking (Step 3).
 */
export default function SiteHeader({
  categories,
}: {
  categories: StoreCategory[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const { totals } = useCart();
  const { productIds } = useWishlist();
  const { user, profile, loading } = useAuth();

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    setMenuOpen(false);
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/shop");
  }

  const accountLabel = loading
    ? "Account"
    : user
      ? (profile?.full_name ?? user.email ?? "Account").split(" ")[0]
      : "Login";

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      {/* Top strip */}
      <div className="bg-[#0f2440] px-4 py-1.5 text-center text-xs font-medium text-white sm:text-sm">
        Free delivery on orders of {formatPKR(FREE_DELIVERY_THRESHOLD)} or more · Winter Sale — Up to 28% Off · Use code <span className="font-bold text-amber-400">WELCOME10</span> for 10% off
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center gap-3 py-3 sm:gap-6">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm font-semibold text-[#0f2440] lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            ☰
          </button>

          <Link href="/" className="shrink-0">
            <span className="text-lg leading-none font-extrabold tracking-tight text-[#0f2440] sm:text-2xl">
              {STORE_NAME}
            </span>
            <span className="block text-[10px] font-medium tracking-widest text-zinc-500 uppercase sm:text-xs">
              Fashion &amp; Clothing Store
            </span>
          </Link>

          {/* Search */}
          <form onSubmit={onSearch} className="hidden min-w-0 flex-1 sm:flex" role="search">
            <label htmlFor="site-search" className="sr-only">
              Search products
            </label>
            <input
              id="site-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jeans, jackets, shirts…"
              className="w-full rounded-l-full border border-zinc-300 px-4 py-2 text-sm outline-none focus:border-[#0f2440]"
            />
            <button
              type="submit"
              className="shrink-0 rounded-r-full bg-[#0f2440] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a3a5c]"
            >
              Search
            </button>
          </form>

          {/* Wishlist / cart / account */}
          <div className="ml-auto flex items-center gap-1 sm:ml-0 sm:gap-2">
            <Link
              href="/wishlist"
              title="Wishlist"
              aria-label={`Wishlist, ${productIds.length} saved items`}
              className="relative rounded-full px-2.5 py-2 text-xl text-[#0f2440] hover:bg-zinc-100"
            >
              ♡
              {productIds.length > 0 && (
                <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">
                  {productIds.length}
                </span>
              )}
            </Link>
            <Link
              href="/cart"
              title="Shopping cart"
              aria-label={`Shopping cart, ${totals.itemCount} items`}
              className="relative rounded-full px-2.5 py-2 text-xl text-[#0f2440] hover:bg-zinc-100"
            >
              🛒
              {totals.itemCount > 0 && (
                <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#0f2440] text-[11px] font-bold text-white">
                  {totals.itemCount}
                </span>
              )}
            </Link>
            <Link
              href={user ? "/account" : "/login"}
              className="hidden rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-[#0f2440] hover:border-[#0f2440] md:block"
            >
              {accountLabel}
            </Link>
          </div>
        </div>

        {/* Mobile search */}
        <form onSubmit={onSearch} className="pb-3 sm:hidden" role="search">
          <label htmlFor="site-search-mobile" className="sr-only">
            Search products
          </label>
          <input
            id="site-search-mobile"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jeans, jackets, shirts…"
            className="w-full rounded-full border border-zinc-300 px-4 py-2 text-sm outline-none focus:border-[#0f2440]"
          />
        </form>

        {/* Desktop category nav */}
        <nav
          className="hidden items-center gap-1 overflow-x-auto border-t border-zinc-100 py-2 lg:flex"
          aria-label="Categories"
        >
          <Link
            href="/shop"
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#0f2440] hover:bg-zinc-100"
          >
            All Products
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap text-zinc-700 hover:bg-zinc-100 hover:text-[#0f2440]"
            >
              {category.name}
            </Link>
          ))}
          <Link
            href="/track"
            className="ml-auto shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap text-zinc-700 hover:bg-zinc-100 hover:text-[#0f2440]"
          >
            Track Order
          </Link>
        </nav>

        {/* Mobile nav */}
        {menuOpen && (
          <nav
            className="grid grid-cols-2 gap-1 border-t border-zinc-100 py-3 lg:hidden"
            aria-label="Categories"
          >
            <Link
              href="/shop"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-[#0f2440]"
            >
              All Products
            </Link>
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700"
              >
                {category.name}
              </Link>
            ))}
            <Link
              href="/cart"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700"
            >
              Cart ({totals.itemCount})
            </Link>
            <Link
              href="/wishlist"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700"
            >
              Wishlist ({productIds.length})
            </Link>
            <Link
              href="/track"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700"
            >
              Track Order
            </Link>
            <Link
              href={user ? "/account" : "/login"}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700"
            >
              {user ? "My Account" : "Login / Sign Up"}
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
