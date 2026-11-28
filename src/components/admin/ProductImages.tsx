"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { deleteProductImage, updateProductImage, uploadProductImages, type CatalogResult } from "@/app/admin/catalog-actions";
import { FormMessage, inputClasses } from "@/components/forms/Field";
import { ProductImage } from "@/components/product/ProductImage";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function ProductImages({ productId, images }: { productId: string; images: Array<{ id: string; url: string; alt: string }> }) {
  const router = useRouter();
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<CatalogResult>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) router.refresh();
    });

  return (
    <section className="rounded-card border border-stone bg-surface p-5 sm:p-6" aria-labelledby={`${uid}-title`} data-testid="product-images">
      <h2 id={`${uid}-title`} className="font-display text-xl">
        Photos
      </h2>
      <p className="mt-1 text-sm text-ink-soft">JPG, PNG or WebP up to 5 MB, up to 8 photos. The first photo is the main one. Portrait (3:4) photos look best.</p>
      {result ? (
        <div className="mt-4">
          <FormMessage tone={result.ok ? "success" : "error"} testId="images-message">{result.message}</FormMessage>
        </div>
      ) : null}

      {images.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="space-y-2" data-testid="product-image">
              <div className="relative aspect-[3/4] overflow-hidden rounded-xs bg-sand">
                <ProductImage src={img.url} alt={img.alt} fill sizes="200px" className="object-cover" />
                {i === 0 ? <span className="absolute top-2 left-2 rounded-xs bg-ink px-2 py-0.5 text-xs text-surface">Main</span> : null}
              </div>
              <input
                aria-label={`Description of photo ${i + 1}`}
                defaultValue={img.alt}
                maxLength={200}
                onBlur={(ev) => {
                  if (ev.target.value !== img.alt) run(() => updateProductImage(img.id, { alt: ev.target.value }));
                }}
                className={cn(inputClasses(false), "h-10 text-sm")}
              />
              <div className="flex gap-1 text-xs">
                <button type="button" className="rounded-xs px-2 py-1 hover:bg-sand disabled:opacity-40" disabled={pending || i === 0} onClick={() => run(() => updateProductImage(img.id, { move: "up" }))} aria-label={`Move photo ${i + 1} earlier`}>
                  ← Earlier
                </button>
                <button type="button" className="rounded-xs px-2 py-1 hover:bg-sand disabled:opacity-40" disabled={pending || i === images.length - 1} onClick={() => run(() => updateProductImage(img.id, { move: "down" }))} aria-label={`Move photo ${i + 1} later`}>
                  Later →
                </button>
                <button
                  type="button"
                  className="ml-auto rounded-xs px-2 py-1 text-sale hover:bg-sale-soft disabled:opacity-40"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Remove this photo?")) run(() => deleteProductImage(img.id));
                  }}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-card border border-dashed border-stone-strong p-6 text-center text-sm text-ink-soft">No photos yet. Products without photos show a placeholder.</p>
      )}

      {images.length < 8 ? (
        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            const data = new FormData(ev.currentTarget);
            run(async () => {
              const r = await uploadProductImages(productId, data);
              if (r.ok && fileRef.current) fileRef.current.value = "";
              return r;
            });
          }}
        >
          <div>
            <label htmlFor={`${uid}-files`} className="text-sm font-medium">
              Add photos
            </label>
            <input
              ref={fileRef}
              id={`${uid}-files`}
              name="images"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="mt-1.5 block text-sm file:mr-3 file:h-10 file:rounded-xs file:border file:border-ink file:bg-surface file:px-4 file:text-sm file:font-medium"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Uploading…" : "Upload"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
