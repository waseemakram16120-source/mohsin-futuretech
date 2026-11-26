/**
 * /admin/products/[id] — edit a product (PDF §5).
 * Live via PATCH /api/admin/products/[id]; demo updates the local admin
 * catalogue in this browser.
 */
"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminGet, adminSend } from "@/lib/admin-client";
import { getAdminCategories, getAdminProducts, saveAdminProducts } from "@/lib/admin-data";
import type { AdminCategory, AdminProduct } from "@/lib/admin-types";
import { COLOR_HEX } from "@/lib/data/products";
import ProductForm, { type ProductFormValue } from "@/components/ProductForm";
import { ErrorState, LoadingState, PageTitle } from "@/components/admin-ui";

export default function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminGet(`/api/admin/products/${id}`)
      .then((json) => {
        if (json.mode === "live" && json.product) {
          setProduct(json.product as AdminProduct);
        } else {
          const found = getAdminProducts().find((p) => p.id === id) ?? null;
          setProduct(found);
          if (!found) setNotFound(true);
        }
      })
      .catch(() => {
        const found = getAdminProducts().find((p) => p.id === id) ?? null;
        setProduct(found);
        if (!found) setNotFound(true);
      });
    adminGet("/api/admin/categories")
      .then((json) => {
        if (json.mode === "live" && Array.isArray(json.categories)) {
          setCategories(json.categories as AdminCategory[]);
        } else {
          setCategories(getAdminCategories());
        }
      })
      .catch(() => setCategories(getAdminCategories()));
  }, [id]);

  async function submit(value: ProductFormValue) {
    setSaving(true);
    setError(null);
    try {
      const json = await adminSend(`/api/admin/products/${id}`, "PATCH", value);
      if (json.mode === "demo") {
        const category = categories?.find((c) => c.id === value.categoryId);
        saveAdminProducts(
          getAdminProducts().map((p) =>
            p.id === id
              ? {
                  ...p,
                  categoryId: value.categoryId,
                  categorySlug: category?.slug ?? p.categorySlug,
                  categoryName: category?.name ?? p.categoryName,
                  name: value.name,
                  slug: value.slug,
                  description: value.description,
                  price: value.price,
                  compareAtPrice: value.compareAtPrice,
                  images: value.images,
                  isFeatured: value.isFeatured,
                  isNew: value.isNew,
                  isActive: value.isActive,
                  variants: value.variants.map((v) => ({
                    id: v.id.startsWith("new-") ? `${id}-${v.sku || `${v.size}-${v.color}`}` : v.id,
                    sku: v.sku,
                    size: v.size,
                    color: v.color,
                    colorHex: COLOR_HEX[v.color] ?? "#6b7280",
                    stock: v.stock,
                    priceOverride: null,
                  })),
                }
              : p,
          ),
        );
      }
      router.push("/admin/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the product.");
    } finally {
      setSaving(false);
    }
  }

  if (notFound) return <ErrorState message="Product not found." />;
  if (!product || !categories) return <LoadingState label="Loading product…" />;

  return (
    <div>
      <PageTitle
        title={`Edit — ${product.name}`}
        action={<Link href="/admin/products" className="text-sm text-sky-700 underline">← All products</Link>}
      />
      {error && <div className="mb-4"><ErrorState message={error} /></div>}
      <ProductForm
        initial={product}
        categories={categories}
        saving={saving}
        onSubmit={(v) => void submit(v)}
      />
    </div>
  );
}
