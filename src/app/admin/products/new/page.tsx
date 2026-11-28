import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/admin/ProductForm";
import { AdminPageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminCategories } from "@/lib/admin/catalog";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requireAdmin("/admin/products/new");
  const categories = await listAdminCategories();
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/admin/products" className="underline underline-offset-4">
          ← All products
        </Link>
      </p>
      <AdminPageHeader title="Add product" description="Create the product first; you can add photos right after." />
      <ProductForm product={null} categories={categories} />
    </div>
  );
}
