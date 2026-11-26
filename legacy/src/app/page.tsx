import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { STORE_NAME } from "@/lib/constants";
import {
  getCategories,
  getFeaturedProducts,
  getNewArrivals,
  getProducts,
  getSaleProducts,
} from "@/lib/data/store";
import { formatPKR, FREE_DELIVERY_THRESHOLD } from "@/lib/constants";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=70";

export default async function Home() {
  const [categories, featured, newArrivals, sale, allProducts] =
    await Promise.all([
      getCategories(),
      getFeaturedProducts(),
      getNewArrivals(),
      getSaleProducts(),
      getProducts(),
    ]);

  return (
    <main>
      {/* Hero promotional banner */}
      <section className="bg-[#0f2440] text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-16">
          <div>
            <p className="text-sm font-bold tracking-widest text-amber-400 uppercase">
              New Season Collection
            </p>
            <h1 className="mt-3 text-3xl leading-tight font-extrabold sm:text-5xl">
              Style that fits every day.
            </h1>
            <p className="mt-4 max-w-lg leading-relaxed text-zinc-300">
              Shop quality jeans, jackets, shirts, trousers and accessories
              from {STORE_NAME}. Cash on Delivery, EasyPaisa, JazzCash and
              NayaPay accepted — delivered across Pakistan.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0f2440] transition hover:bg-zinc-200"
              >
                Shop Now
              </Link>
              <Link
                href="/shop?sale=1"
                className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Winter Sale — Up to 28% Off
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-300">
              Use code{" "}
              <span className="rounded bg-white/15 px-2 py-0.5 font-bold text-amber-400">
                WELCOME10
              </span>{" "}
              for 10% off your first order (min {formatPKR(2000)}).
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl">
            <img
              src={HERO_IMAGE}
              alt="Mohsin FutureTech fashion collection"
              className="aspect-[16/10] w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-5 text-center sm:px-6 lg:grid-cols-4">
          {[
            { title: "Cash on Delivery", text: "Pay when it arrives" },
            { title: "EasyPaisa, JazzCash & NayaPay", text: "Manual verification" },
            { title: "Delivery Across Pakistan", text: "Flat Rs 200 · Free on orders of Rs 5,000 or more" },
            { title: "Quality Checked", text: "Every item inspected" },
          ].map((item) => (
            <div key={item.title}>
              <p className="text-sm font-bold text-[#0f2440]">{item.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
              Shop by Category
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Men, women, jackets, jeans, shirts, trousers and accessories.
            </p>
          </div>
          <Link
            href="/shop"
            className="shrink-0 text-sm font-semibold text-[#0f2440] hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="group relative overflow-hidden rounded-xl"
            >
              <img
                src={category.image}
                alt={category.name}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="absolute bottom-0 left-0 p-4">
                <span className="block text-lg font-bold text-white">
                  {category.name}
                </span>
                <span className="block text-xs text-zinc-200">
                  {category.description}
                </span>
              </span>
            </Link>
          ))}
          {/* Promo tile — completes the grid */}
          <Link
            href="/shop?sale=1"
            className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-red-600 p-5 text-white"
          >
            <span className="text-sm font-bold tracking-widest uppercase">
              Winter Sale
            </span>
            <span>
              <span className="block text-2xl font-extrabold">
                Up to 28% Off
              </span>
              <span className="mt-1 block text-sm text-red-100">
                Selected jeans, jackets &amp; shirts.
              </span>
              <span className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-sm font-bold text-red-600">
                Shop the Sale →
              </span>
            </span>
          </Link>
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
            Featured Products
          </h2>
          <Link
            href="/shop?sort=featured"
            className="shrink-0 text-sm font-semibold text-[#0f2440] hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Coupon strip */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl bg-amber-400 px-6 py-8 text-center sm:px-10">
          <p className="text-sm font-bold tracking-widest text-amber-900 uppercase">
            First order offer
          </p>
          <p className="mt-2 text-2xl font-extrabold text-[#0f2440] sm:text-3xl">
            Get 10% off with code WELCOME10
          </p>
          <p className="mt-2 text-sm text-amber-900">
            Valid on orders of {formatPKR(2000)} or more. Apply the code in
            the coupon box on the Cart page.
          </p>
          <Link
            href="/shop"
            className="mt-5 inline-block rounded-full bg-[#0f2440] px-6 py-3 text-sm font-bold text-white"
          >
            Start Shopping
          </Link>
        </div>
      </section>

      {/* New arrivals */}
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
            New Arrivals
          </h2>
          <Link
            href="/shop?sort=newest"
            className="shrink-0 text-sm font-semibold text-[#0f2440] hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Sale */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
              On Sale
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Save on jeans, jackets, shirts and more — while stocks last.
            </p>
          </div>
          <Link
            href="/shop?sale=1"
            className="shrink-0 text-sm font-semibold text-[#0f2440] hover:underline"
          >
            View all sale →
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {sale.slice(0, 4).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-zinc-500">
          {allProducts.length} products · Free delivery on orders of{" "}
          {formatPKR(FREE_DELIVERY_THRESHOLD)} or more · COD, EasyPaisa,
          JazzCash &amp; NayaPay accepted
        </p>
      </section>
    </main>
  );
}
