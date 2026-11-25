import Link from "next/link";
import { STORE_NAME, STORE_TAGLINE } from "@/lib/constants";
import type { StoreCategory } from "@/lib/data/categories";

/** Site-wide footer: about, shop links, customer care, payment methods. */
export default function SiteFooter({
  categories,
}: {
  categories: StoreCategory[];
}) {
  return (
    <footer className="mt-16 bg-[#0f2440] text-zinc-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="text-xl font-extrabold text-white">{STORE_NAME}</p>
          <p className="mt-1 text-sm text-zinc-400">{STORE_TAGLINE}</p>
          <p className="mt-4 text-sm leading-relaxed">
            A professional online fashion store — quality jeans, jackets,
            shirts, trousers and accessories, delivered across Pakistan.
          </p>
        </div>

        <nav aria-label="Shop">
          <p className="text-sm font-bold tracking-wide text-white uppercase">
            Shop
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/shop" className="hover:text-white">
                All Products
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/category/${category.slug}`}
                  className="hover:text-white"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Customer care">
          <p className="text-sm font-bold tracking-wide text-white uppercase">
            Customer Care
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/shop?sale=1" className="hover:text-white">
                Sale &amp; Offers
              </Link>
            </li>
            <li>
              <Link href="/shop?sort=newest" className="hover:text-white">
                New Arrivals
              </Link>
            </li>
            <li>
              <Link href="/track" className="hover:text-white">
                Track Your Order
              </Link>
            </li>
            <li>
              <Link href="/account" className="hover:text-white">
                My Account
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <p className="text-sm font-bold tracking-wide text-white uppercase">
            Payment Methods
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>Cash on Delivery (COD)</li>
            <li>EasyPaisa</li>
            <li>JazzCash</li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed">
            EasyPaisa / JazzCash payments are verified manually by our team
            before your order is confirmed. No automatic payment gateway.
          </p>
          <p className="mt-4 text-sm">
            Delivery across Pakistan · Flat Rs 200 · Free above Rs 5,000
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs text-zinc-400">
        © 2026 {STORE_NAME}. All rights reserved. ·
        Cash on Delivery · EasyPaisa · JazzCash
      </div>
    </footer>
  );
}
