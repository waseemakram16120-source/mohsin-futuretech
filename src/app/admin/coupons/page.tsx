import type { Metadata } from "next";
import { CouponManager } from "@/components/admin/CouponManager";
import { AdminPageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { listCoupons } from "@/lib/admin/catalog";

export const metadata: Metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  await requireAdmin("/admin/coupons");
  const coupons = await listCoupons();
  return (
    <div>
      <AdminPageHeader title="Coupons" description="Codes customers enter in the bag. Each use is counted when an order is placed." />
      <CouponManager coupons={coupons} />
    </div>
  );
}
