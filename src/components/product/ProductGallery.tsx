"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ProductImage } from "./ProductImage";

/**
 * Desktop: large image with a thumbnail rail. Mobile: swipeable carousel
 * with dots. Both stay in sync.
 */
export function ProductGallery({ images, name }: { images: Array<{ url: string; alt: string }>; name: string }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return <div className="aspect-[3/4] rounded-card bg-sand" role="img" aria-label={`${name} — image coming soon`} />;
  }

  const goTo = (index: number) => {
    setActive(index);
    const track = trackRef.current;
    if (track) track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="lg:grid lg:grid-cols-[4.5rem_1fr] lg:gap-4">
      {images.length > 1 ? (
        <ul className="hidden flex-col gap-3 lg:flex" aria-label="Product images">
          {images.map((image, i) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={active === i}
                className={cn(
                  "relative block aspect-[3/4] w-full overflow-hidden rounded-xs bg-sand ring-offset-2 ring-offset-paper transition",
                  active === i ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100",
                )}
              >
                <ProductImage src={image.url} alt="" fill sizes="72px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative -mx-4 sm:mx-0">
        <div
          ref={trackRef}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto sm:rounded-card lg:overflow-hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            const index = Math.round(el.scrollLeft / el.clientWidth);
            if (index !== active) setActive(index);
          }}
          aria-roledescription="carousel"
          aria-label={`${name} images`}
          // Scrollable regions must be reachable by keyboard (WCAG 2.1.1).
          tabIndex={0}
        >
          {images.map((image, i) => (
            <div
              key={image.url}
              className="relative aspect-[3/4] w-full shrink-0 snap-center bg-sand"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${images.length}`}
            >
              <ProductImage
                src={image.url}
                alt={image.alt}
                fill
                priority={i === 0}
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
        {images.length > 1 ? (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2 lg:hidden">
            {images.map((image, i) => (
              <button
                key={image.url}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={active === i}
                className="flex size-6 items-center justify-center"
              >
                <span className={cn("block size-2 rounded-full transition", active === i ? "bg-ink" : "bg-ink/30")} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
