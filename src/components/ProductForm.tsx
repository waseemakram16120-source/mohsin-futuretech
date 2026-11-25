/**
 * Shared product form (Step 5) — used by /admin/products/new and
 * /admin/products/[id]. Manages name, slug, description, price,
 * compare-at price, category, flags, image URLs and size/colour/stock
 * variants. Image upload to Supabase Storage is a live-mode note: the
 * form takes image URLs (Unsplash or uploaded elsewhere) for now.
 */
"use client";

import { useState } from "react";
import type { AdminCategory, AdminProduct } from "@/lib/admin-types";
import { COLOR_HEX } from "@/lib/data/products";

export interface ProductFormValue {
  name: string;
  slug: string;
  description: string;
  categoryId: string | null;
  price: number;
  compareAtPrice: number | null;
  images: string[];
  isFeatured: boolean;
  isNew: boolean;
  isActive: boolean;
  variants: Array<{ id: string; sku: string; size: string; color: string; stock: number }>;
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function ProductForm({
  initial,
  categories,
  saving,
  onSubmit,
}: {
  initial?: AdminProduct | null;
  categories: AdminCategory[];
  saving: boolean;
  onSubmit: (value: ProductFormValue) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [compareAtPrice, setCompareAtPrice] = useState(
    initial?.compareAtPrice != null ? String(initial.compareAtPrice) : "",
  );
  const [imagesText, setImagesText] = useState((initial?.images ?? []).join("\n"));
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [isNew, setIsNew] = useState(initial?.isNew ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [variants, setVariants] = useState<
    Array<{ id: string; sku: string; size: string; color: string; stock: number }>
  >(() =>
    initial?.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      stock: v.stock,
    })) ?? [{ id: `new-${Date.now()}`, sku: "", size: "M", color: "Black", stock: 10 }],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const images = imagesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    onSubmit({
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      description: description.trim(),
      categoryId: categoryId || null,
      price: Number(price),
      compareAtPrice: compareAtPrice.trim() ? Number(compareAtPrice) : null,
      images,
      isFeatured,
      isNew,
      isActive,
      variants: variants.map((v) => ({
        ...v,
        sku: v.sku.trim(),
        size: v.size.trim(),
        color: v.color.trim(),
      })),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Product name *</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!initial) setSlug(slugify(e.target.value));
            }}
            required
            className="w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Slug</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Category</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Price (Rs) *</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              type="number"
              min={1}
              className="w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Compare-at price (Rs)</span>
            <input
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              type="number"
              min={0}
              placeholder="Optional"
              className="w-full rounded border px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Image URLs (one per line)</span>
          <textarea
            value={imagesText}
            onChange={(e) => setImagesText(e.target.value)}
            rows={2}
            placeholder="https://images.unsplash.com/photo-…"
            className="w-full rounded border px-3 py-2"
          />
          <span className="text-xs text-zinc-500">
            Paste image URLs for now. Direct upload to Supabase Storage is
            available once the live project is connected.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
          Featured product
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} />
          New arrival
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active (visible on storefront)
        </label>
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-[#0f2440]">Variants — size / colour / stock</h3>
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={v.id} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <input
                value={v.size}
                onChange={(e) =>
                  setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))
                }
                placeholder="Size (e.g. M / 32)"
                className="rounded border px-2 py-1.5 text-sm"
                aria-label="Variant size"
              />
              <select
                value={v.color}
                onChange={(e) =>
                  setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))
                }
                className="rounded border px-2 py-1.5 text-sm"
                aria-label="Variant colour"
              >
                {Object.keys(COLOR_HEX).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                value={v.stock}
                onChange={(e) =>
                  setVariants((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, stock: Number(e.target.value) || 0 } : x)),
                  )
                }
                type="number"
                min={0}
                placeholder="Stock"
                className="rounded border px-2 py-1.5 text-sm"
                aria-label="Variant stock"
              />
              <input
                value={v.sku}
                onChange={(e) =>
                  setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))
                }
                placeholder="SKU (auto if empty)"
                className="rounded border px-2 py-1.5 text-sm"
                aria-label="Variant SKU"
              />
              <button
                type="button"
                onClick={() => setVariants((prev) => prev.filter((_, j) => j !== i))}
                className="rounded border px-2 py-1.5 text-sm text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setVariants((prev) => [
              ...prev,
              { id: `new-${Date.now()}`, sku: "", size: "M", color: "Black", stock: 10 },
            ])
          }
          className="mt-2 rounded border px-3 py-1.5 text-sm"
        >
          + Add variant
        </button>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-[#0f2440] px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : initial ? "Save changes" : "Add product"}
      </button>
    </form>
  );
}
