import Link from "next/link";
import type { ReactNode } from "react";
import { GATEWAY_METHODS, PAYMENT_METHOD_LABELS } from "@/config/store";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductImage } from "@/components/product/ProductImage";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { Category, ProductCardData } from "@/lib/catalog/mappers";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

/* -------------------------------------------------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  href,
  linkLabel = "View all",
  id,
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  linkLabel?: string;
  id: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
      <div>
        {eyebrow ? <p className="eyebrow text-accent">{eyebrow}</p> : null}
        <h2 id={id} className="mt-2 font-display text-[1.75rem] leading-tight font-medium tracking-tight sm:text-4xl">
          {title}
        </h2>
      </div>
      {href ? (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 pb-1 text-sm font-medium text-ink-soft hover:text-ink"
        >
          {linkLabel}
          <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

function Section({ labelledBy, className, children }: { labelledBy: string; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={labelledBy} className={cn("container-page mt-20 sm:mt-24", className)}>
      {children}
    </section>
  );
}

/* --------------------------------- Hero ---------------------------------- */

export function Hero({ freeDeliveryMin, images }: { freeDeliveryMin: number; images: ProductCardData[] }) {
  const [main, second] = images;
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-sand">
      {/* Decorative stitched line, echoing denim seams. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-40 hidden h-[36rem] w-[36rem] text-stone-strong lg:block"
        viewBox="0 0 400 400"
        fill="none"
      >
        <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 8" />
        <circle cx="200" cy="200" r="140" stroke="currentColor" strokeWidth="1" />
      </svg>

      <div className="container-page relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
        <div className="max-w-xl">
          <p className="eyebrow text-accent">New season · Autumn / Winter</p>
          <h1
            id="hero-title"
            className="mt-4 font-display text-[2.5rem] leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl lg:text-display"
          >
            Dressed for the city. <em className="font-normal text-accent">Built</em> for the season.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-soft sm:text-lg">
            Considered jackets, denim and shirts for men and women — delivered to your door anywhere in
            Pakistan.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/collections/men" size="lg">
              Shop Men
            </ButtonLink>
            <ButtonLink href="/collections/women" size="lg" variant="secondary">
              Shop Women
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
            <li className="flex items-center gap-2">
              <Icon name="cash" className="size-4 text-accent" /> Cash on Delivery
            </li>
            <li className="flex items-center gap-2">
              <Icon name="truck" className="size-4 text-accent" /> Free delivery over {formatPrice(freeDeliveryMin)}
            </li>
          </ul>
        </div>

        {main ? (
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div aria-hidden="true" className="absolute top-8 -left-3 h-[85%] w-[70%] rounded-card bg-accent sm:-left-6" />
            <div className="relative ml-auto grid w-[88%] grid-cols-5 gap-3">
              <Link
                href={`/products/${main.slug}`}
                className="relative col-span-3 aspect-[3/4] overflow-hidden rounded-card bg-surface shadow-lift"
              >
                {main.image ? (
                  <ProductImage src={main.image.url} alt={main.image.alt} fill priority sizes="(min-width: 1024px) 28vw, 55vw" className="object-cover" />
                ) : null}
                <span className="absolute inset-x-3 bottom-3 rounded-xs bg-surface/95 px-3 py-2 text-xs font-medium">
                  {main.name}
                </span>
              </Link>
              {second ? (
                <Link
                  href={`/products/${second.slug}`}
                  className="relative col-span-2 mt-16 aspect-[3/4] self-start overflow-hidden rounded-card bg-surface shadow-lift"
                >
                  {second.image ? (
                    <ProductImage src={second.image.url} alt={second.image.alt} fill priority sizes="(min-width: 1024px) 18vw, 35vw" className="object-cover" />
                  ) : null}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------ Trust strip ------------------------------ */

export function TrustStrip({ freeDeliveryMin }: { freeDeliveryMin: number }) {
  const items: Array<{ icon: IconName; title: string; text: string }> = [
    { icon: "truck", title: "Nationwide delivery", text: `Free on orders of ${formatPrice(freeDeliveryMin)} or more` },
    { icon: "cash", title: "Cash on Delivery", text: "Pay when your parcel arrives" },
    { icon: "wallet", title: "Mobile wallets", text: GATEWAY_METHODS.map((m) => PAYMENT_METHOD_LABELS[m]).join(" · ") },
    { icon: "shield", title: "Secure payments", text: "Pay on the wallet’s own secure page" },
  ];
  return (
    <section aria-label="Why shop with us" className="border-b border-stone bg-surface">
      <ul className="container-page grid grid-cols-2 gap-x-4 gap-y-6 py-6 sm:py-8 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon name={item.icon} className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-[0.8125rem]">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ Categories ------------------------------- */

export function CategoryTiles({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;
  return (
    <Section labelledBy="categories-title">
      <SectionHeading id="categories-title" eyebrow="Collections" title="Shop by category" href="/shop" linkLabel="Shop all" />
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-5">
        {categories.map((category) => (
          <li key={category.id} className="w-[42%] shrink-0 snap-start sm:w-auto">
            <Link href={`/collections/${category.slug}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-[#3b4252]">
                {category.imageUrl ? (
                  <ProductImage
                    src={category.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 42vw"
                    className="object-cover transition-transform duration-700 ease-out-soft group-hover:scale-105"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4 text-surface">
                  <span className="font-display text-lg font-medium sm:text-xl">{category.name}</span>
                  <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------------------------- Product listings --------------------------- */

export function ProductRail({
  id,
  eyebrow,
  title,
  href,
  products,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  href: string;
  products: ProductCardData[];
}) {
  if (products.length === 0) return null;
  return (
    <Section labelledBy={id}>
      <SectionHeading id={id} eyebrow={eyebrow} title={title} href={href} />
      {/* Swipeable on phones, a grid from tablet up. */}
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id} className="w-[46%] shrink-0 snap-start sm:w-auto">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ProductGrid({
  id,
  eyebrow,
  title,
  href,
  products,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  href: string;
  products: ProductCardData[];
}) {
  if (products.length === 0) return null;
  return (
    <Section labelledBy={id}>
      <SectionHeading id={id} eyebrow={eyebrow} title={title} href={href} />
      <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* --------------------------- Men / Women split --------------------------- */

export function AudienceSplit({
  panels,
}: {
  panels: Array<{ key: "men" | "women"; title: string; count: number; product: ProductCardData | null }>;
}) {
  return (
    <Section labelledBy="audience-title">
      <h2 id="audience-title" className="sr-only">
        Shop men and women
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        {panels.map((panel, index) => (
          <Link
            key={panel.key}
            href={`/collections/${panel.key}`}
            className={cn(
              "group relative flex min-h-[22rem] overflow-hidden rounded-card sm:min-h-[30rem]",
              index === 0 ? "bg-accent text-surface" : "bg-stone text-ink",
            )}
          >
            {panel.product?.image ? (
              <div className="absolute inset-y-6 right-6 w-[46%] overflow-hidden rounded-card shadow-lift sm:inset-y-10 sm:right-10">
                <ProductImage
                  src={panel.product.image.url}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 22vw, 45vw"
                  className="object-cover transition-transform duration-700 ease-out-soft group-hover:scale-105"
                />
              </div>
            ) : null}
            <div className="relative mt-auto max-w-[48%] p-6 sm:p-10">
              <p className={cn("eyebrow", index === 0 ? "text-surface/80" : "text-ink-soft")}>
                {panel.count} {panel.count === 1 ? "style" : "styles"}
              </p>
              <p className="mt-2 font-display text-4xl font-medium tracking-tight sm:text-5xl">{panel.title}</p>
              <span className="mt-5 inline-flex items-center gap-2 border-b border-current pb-1 text-sm font-medium">
                Explore <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

/* --------------------------------- Sale ---------------------------------- */

export function SaleBanner({ maxDiscount }: { maxDiscount: number }) {
  if (maxDiscount <= 0) return null;
  return (
    <section aria-labelledby="sale-title" className="container-page mt-20 sm:mt-24">
      <div className="relative overflow-hidden rounded-card bg-ink px-6 py-12 text-surface sm:px-12 sm:py-16">
        <svg aria-hidden="true" className="absolute -right-10 -bottom-16 h-72 w-72 text-surface/10" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="2" strokeDasharray="4 6" />
          <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="2" />
        </svg>
        <p className="eyebrow text-surface/70">Limited time</p>
        <h2 id="sale-title" className="mt-3 max-w-lg font-display text-4xl font-medium tracking-tight sm:text-5xl">
          Up to {maxDiscount}% off selected styles
        </h2>
        <p className="mt-4 max-w-md text-surface/80">Reduced prices on jackets, denim, shirts and accessories while stocks last.</p>
        <ButtonLink href="/sale" variant="inverse" size="lg" className="mt-8">
          Shop the sale
        </ButtonLink>
      </div>
    </section>
  );
}
