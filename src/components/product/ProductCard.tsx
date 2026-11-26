import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import type { ProductCardData } from "@/lib/catalog/mappers";
import { cn } from "@/lib/cn";
import { discountPercent } from "@/lib/format";
import { ProductImage } from "./ProductImage";

const MAX_SWATCHES = 4;

export function ProductCard({
  product,
  priority = false,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
}: {
  product: ProductCardData;
  priority?: boolean;
  sizes?: string;
}) {
  const discount = discountPercent(product.price, product.compareAtPrice);
  const href = `/products/${product.slug}`;

  return (
    <article className="group relative flex flex-col" data-testid="product-card">
      <div className="relative aspect-[3/4] overflow-hidden rounded-card bg-sand">
        {product.image ? (
          <ProductImage
            src={product.image.url}
            alt={product.image.alt}
            fill
            sizes={sizes}
            priority={priority}
            className={cn(
              "object-cover transition duration-500 ease-out-soft",
              product.hoverImage && "group-hover:opacity-0",
              !product.inStock && "opacity-60",
            )}
          />
        ) : null}
        {product.hoverImage ? (
          <ProductImage
            src={product.hoverImage.url}
            alt=""
            fill
            sizes={sizes}
            className="scale-[1.02] object-cover opacity-0 transition duration-500 ease-out-soft group-hover:scale-100 group-hover:opacity-100"
          />
        ) : null}

        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          {!product.inStock ? (
            <Badge tone="dark">Sold out</Badge>
          ) : discount > 0 ? (
            <Badge tone="sale">−{discount}%</Badge>
          ) : product.isNew ? (
            <Badge tone="new">New</Badge>
          ) : null}
        </div>

        {product.inStock && product.sizesInStock.length > 1 ? (
          <ul
            aria-label="Sizes in stock"
            className="absolute inset-x-2.5 bottom-2.5 hidden flex-wrap gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:flex"
          >
            {product.sizesInStock.map((size) => (
              <li key={size} className="rounded-xs bg-surface/95 px-2 py-0.5 text-[0.6875rem] font-medium">
                {size}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-1">
        {product.categoryName ? <p className="text-xs text-muted">{product.categoryName}</p> : null}
        <h3 className="text-sm leading-snug font-medium text-ink">
          <Link href={href} className="after:absolute after:inset-0 hover:underline hover:underline-offset-4">
            {product.name}
          </Link>
        </h3>
        <div className="flex items-baseline gap-1">
          {product.priceVaries ? <span className="text-xs text-muted">From</span> : null}
          <Price price={product.price} compareAt={product.compareAtPrice} />
        </div>
        {product.colors.length > 1 ? (
          <ul className="mt-1 flex items-center gap-1.5" aria-label={`${product.colors.length} colours`}>
            {product.colors.slice(0, MAX_SWATCHES).map((color) => (
              <li
                key={color.name}
                title={color.name}
                className="size-3 rounded-full ring-1 ring-stone-strong ring-offset-1 ring-offset-paper"
                style={{ backgroundColor: color.hex }}
              >
                <span className="sr-only">{color.name}</span>
              </li>
            ))}
            {product.colors.length > MAX_SWATCHES ? (
              <li className="text-xs text-muted">+{product.colors.length - MAX_SWATCHES}</li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
