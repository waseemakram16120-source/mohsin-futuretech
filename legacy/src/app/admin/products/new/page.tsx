/**
 * /admin/products/new — add a product (PDF §5).
 * Live via POST /api/admin/products; demo saves to the local admin
 * catalogue in this browser.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminGet, adminSend } from "@/lib/admin-client";
import { getAdminCategories, getAdminProducts, saveAdminProducts } from "@/lib/admin-data";
import type { AdminCategory } from "@/lib/admin-types";
import { COLOR_HEX } from "@/lib/data/products";
import ProductForm, { type ProductFormValue } from "@/components/ProductForm";
import { ErrorState, LoadingState, PageTitle } from "@/components/admin-ui";

export default function AdminProductNewPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminGet("/api/admin/categories")
      .then((json) => {
        if (json.mode === "live" && Array.isArray(json.categories)) {
          setCategories(json.categories as AdminCategory[]);
        } else {
          setCategories(getAdminCategories());
        }
      })
      .catch(() => setCategories(getAdminCategories()));
  }, []);

  async function submit(value: ProductFormValue) {
    setSaving(true);
    setError(null);
    try {
      const json = await adminSend("/api/admin/products", "POST", value);
      if (json.mode === "demo") {
        const products = getAdminProducts();
        const id = `demo-product-${Date.now()}`;
        const category = categories?.find((c) => c.id === value.categoryId);
        saveAdminProducts([
          {
            id,
            categoryId: value.categoryId,
            categorySlug: category?.slug ?? "",
            categoryName: category?.name ?? "—",
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
              id: `${id}-${v.sku || `${v.size}-${v.color}`}`,
              sku: v.sku || `MF-${value.name.slice(0, 3).toUpperCase()}`,
              size: v.size,
              color: v.color,
              colorHex: COLOR_HEX[v.color] ?? "#6b7280",
              stock: v.stock,
              priceOverride: null,
            })),
            demo: true,
          },
          ...products,
        ]);
      }
      router.push("/admin/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the product.");
    } finally {
      setSaving(false);
    }
  }

  if (!categories) return <LoadingState label="Loading…" />;

  return (
    <div>
      <PageTitle
        title="Add product"
        action={<Link href="/admin/products" className="text-sm text-sky-700 underline">← All products</Link>}
      />
      {error && <div className="mb-4"><ErrorState message={error} /></div>}
      <ProductForm categories={categories} saving={saving} onSubmit={(v) => void submit(v)} />
    </div>
  );
}
