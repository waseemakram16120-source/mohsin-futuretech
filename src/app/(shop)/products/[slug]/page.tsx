import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GATEWAY_METHODS, PAYMENT_METHOD_LABELS, storeConfig } from "@/config/store";
import { sizeChartFor } from "@/config/size-guide";
import { ProductRail } from "@/components/home/sections";
import { Breadcrumbs } from "@/components/listing/ListingPage";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { RawSearchParams } from "@/lib/catalog/filters";
import { getProductBySlug, getRelatedProducts, getStoreSettings } from "@/lib/catalog/queries";
import { discountPercent, formatPrice } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const description = product.description.slice(0, 160);
  const image = product.images[0]?.url;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title: product.name, description, images: image ? [{ url: image, alt: product.name }] : undefined },
  };
}

/** Escape "<" so product text can never close the JSON-LD script tag. */
function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const [product, settings, query] = await Promise.all([getProductBySlug(slug), getStoreSettings(), searchParams]);
  if (!product) notFound();
  const related = await getRelatedProducts(product);

  const minPrice = Math.min(...product.variants.map((v) => v.price), product.basePrice);
  const inStock = product.variants.some((v) => v.stock > 0);
  const discount = discountPercent(minPrice, product.compareAtPrice);
  const chart = sizeChartFor(product.category?.slug, product.sizes);
  const askHref = whatsappLink(settings.whatsapp, `Hi, I have a question about ${product.name}.`);

  const crumbs = [
    { label: "Home", href: "/" },
    ...(product.category ? [{ label: product.category.name, href: `/collections/${product.category.slug}` }] : []),
    { label: product.name },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description,
          sku: product.variants[0]?.sku,
          image: product.images.map((i) => i.url),
          category: product.category?.name,
          brand: { "@type": "Brand", name: storeConfig.name },
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: storeConfig.currency,
            lowPrice: minPrice,
            highPrice: Math.max(...product.variants.map((v) => v.price), minPrice),
            offerCount: product.variants.length,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        })}
      />

      <div className="container-page pt-6 pb-4">
        <Breadcrumbs items={crumbs} />
      </div>

      <div className="container-page grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 xl:gap-20">
        <ProductGallery images={product.images} name={product.name} />

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-wrap items-center gap-2">
            {product.category ? <p className="eyebrow text-accent">{product.category.name}</p> : null}
            {product.isNew ? <Badge tone="new">New</Badge> : null}
            {discount > 0 ? <Badge tone="sale">Save {discount}%</Badge> : null}
          </div>
          <h1 className="mt-3 font-display text-3xl leading-tight font-medium tracking-tight sm:text-4xl">{product.name}</h1>

          <div className="mt-5">
            <ProductPurchase
              product={product}
              requested={{ color: one(query.color), size: one(query.size) }}
              lowStockThreshold={settings.lowStockThreshold}
              sizeChart={chart}
            />
          </div>

          <ul className="mt-8 grid gap-3 rounded-card border border-stone bg-surface p-5 text-sm">
            <li className="flex gap-3">
              <Icon name="truck" className="size-5 shrink-0 text-accent" />
              <span>
                Delivery in {storeConfig.delivery.estimate} across Pakistan. <strong className="font-semibold">Free</strong> on orders of{" "}
                {formatPrice(settings.freeDeliveryMin)} or more, otherwise {formatPrice(settings.deliveryCharge)}.
              </span>
            </li>
            <li className="flex gap-3">
              <Icon name="cash" className="size-5 shrink-0 text-accent" />
              <span>
                Pay with Cash on Delivery, {GATEWAY_METHODS.map((m) => PAYMENT_METHOD_LABELS[m]).join(" or ")}.
              </span>
            </li>
            {askHref ? (
              <li className="flex gap-3">
                <Icon name="phone" className="size-5 shrink-0 text-accent" />
                <span>
                  Questions about fit?{" "}
                  <a href={askHref} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">
                    Ask us on WhatsApp
                  </a>
                </span>
              </li>
            ) : null}
          </ul>

          <div className="mt-8 divide-y divide-stone border-y border-stone">
            <details className="group py-4" open>
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                Description
                <Icon name="chevronDown" className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{product.description}</p>
            </details>
            {product.details.length > 0 ? (
              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                  Details &amp; fabric
                  <Icon name="chevronDown" className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                  {product.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
      </div>

      <ProductRail
        id="related-title"
        eyebrow="You may also like"
        title={product.category ? `More ${product.category.name.toLowerCase()}` : "More to explore"}
        href={product.category ? `/collections/${product.category.slug}` : "/shop"}
        products={related}
      />
    </>
  );
}
