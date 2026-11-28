import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { AdminPageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminCategories } from "@/lib/admin/catalog";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");
  const categories = await listAdminCategories();
  return (
    <div>
      <AdminPageHeader title="Categories" description="Collections in the shop menu. Hidden categories stay available here." />
      <CategoryManager categories={categories} />
    </div>
  );
}
