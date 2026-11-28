import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDanger } from "@/components/admin/ProductDanger";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductImages } from "@/components/admin/ProductImages";
import { AdminPageHeader } from "@/components/admin/ui";
import { FormMessage } from "@/components/forms/Field";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/admin/auth";
import { getProductForEdit, listAdminCategories } from "@/lib/admin/catalog";

export const metadata: Metadata = { title: "Edit product" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

export default async function EditProductPage({ params, searchParams }: Props) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  await requireAdmin(`/admin/products/${id}`);
  const [product, categories] = await Promise.all([getProductForEdit(id), listAdminCategories()]);
  if (!product) notFound();
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm">
          <Link href="/admin/products" className="underline underline-offset-4">
            ← All products
          </Link>
        </p>
        <AdminPageHeader
          title={product.name}
          description={
            <>
              {product.isActive ? (
                <Link href={`/products/${product.slug}`} target="_blank" className="underline underline-offset-4">
                  View in shop ↗
                </Link>
              ) : (
                <Badge>Archived — hidden from the shop</Badge>
              )}
            </>
          }
        />
        {created ? <FormMessage tone="success">Product created. Now add photos below.</FormMessage> : null}
      </div>
      <ProductImages productId={product.id} images={product.images} />
      <ProductForm key={JSON.stringify(product.variants.map((v) => [v.id, v.stock, v.isActive]))} product={product} categories={categories} />
      <ProductDanger productId={product.id} isActive={product.isActive} hasOrders={product.hasOrders} />
    </div>
  );
}
