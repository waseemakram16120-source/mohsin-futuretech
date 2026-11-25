import Link from "next/link";
import { formatPKR } from "@/lib/constants";
import WishlistButton from "@/components/WishlistButton";
import {
  discountPercent,
  productColors,
  productSizes,
  stockLabel,
  totalStock,
  type StoreProduct,
} from "@/lib/data/products";

/**
 * Product card — image, name, category, price, compare-at price, badge
 * (New / Sale / Featured), size + colour dots, and stock state.
 * Used on the homepage, shop, category and search pages.
 */
export default function ProductCard({ product }: { product: StoreProduct }) {
  const discount = discountPercent(product);
  const stock = totalStock(product);
  const outOfStock = stock <= 0;
  const badge = product.isNew
    ? { label: "New", classes: "bg-emerald-600 text-white" }
    : discount > 0
      ? { label: `Sale −${discount}%`, classes: "bg-red-600 text-white" }
      : product.isFeatured
        ? { label: "Featured", classes: "bg-[#0f2440] text-white" }
        : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:shadow-lg">
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden bg-zinc-100"
        aria-label={product.name}
      >
        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        {badge && (
          <span
            className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-bold ${badge.classes}`}
          >
            {badge.label}
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1.5 text-center text-xs font-semibold text-white">
            Out of Stock
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          {product.categoryName}
        </p>
        <Link href={`/product/${product.slug}`}>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold text-zinc-900 hover:text-[#0f2440]">
            {product.name}
          </h3>
        </Link>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-[#0f2440]">
            {formatPKR(product.price)}
          </span>
          {product.compareAtPrice && (
            <span className="text-sm text-zinc-400 line-through">
              {formatPKR(product.compareAtPrice)}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1.5" aria-label="Available colours">
          {productColors(product).map((color) => {
            const variant = product.variants.find((v) => v.color === color);
            return (
              <span
                key={color}
                title={color}
                className="inline-block h-4 w-4 rounded-full border border-zinc-300"
                style={{ backgroundColor: variant?.colorHex ?? "#ccc" }}
              />
            );
          })}
        </div>

        {/* Size pills (Furor-style): availability at a glance, no need to open the product. */}
        <div className="mt-2 flex flex-wrap gap-1" aria-label="Available sizes">
          {productSizes(product).map((s) => {
            const inStock = product.variants.some(
              (v) => v.size === s && v.stock > 0,
            );
            return (
              <span
                key={s}
                title={
                  inStock ? `Size ${s} available` : `Size ${s} out of stock`
                }
                className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                  inStock
                    ? "border-zinc-300 text-zinc-700"
                    : "border-zinc-200 text-zinc-400 line-through"
                }`}
              >
                {s}
              </span>
            );
          })}
        </div>

        <p
          className={`mt-2 text-xs font-semibold ${
            outOfStock
              ? "text-red-600"
              : stock <= 5
                ? "text-amber-600"
                : "text-emerald-600"
          }`}
        >
          {stockLabel(product)}
          {stock > 0 && stock <= 5 ? ` — only ${stock} left` : ""}
        </p>

        <Link
          href={`/product/${product.slug}`}
          className="mt-3 rounded-full bg-[#0f2440] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-[#1a3a5c]"
        >
          View Product
        </Link>
        <div className="mt-2">
          <WishlistButton productId={product.id} productName={product.name} label />
        </div>
      </div>
    </article>
  );
}
