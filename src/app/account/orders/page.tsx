import type { Metadata } from "next";
import Link from "next/link";
import { OrderList } from "@/components/account/OrderList";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { requireUser } from "@/lib/auth/session";
import { getMyOrders } from "@/lib/orders/account";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default async function MyOrdersPage() {
  await requireUser("/account/orders");
  const orders = await getMyOrders();
  return (
    <section aria-labelledby="orders-title">
      <h2 id="orders-title" className="font-display text-2xl">
        Orders
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        Orders placed while signed in. Placed one as a guest?{" "}
        <Link href="/track" className="underline underline-offset-4">
          Track it with your order number
        </Link>
        .
      </p>
      <div className="mt-5">
        {orders.length > 0 ? (
          <OrderList orders={orders} />
        ) : (
          <EmptyState icon="bag" title="No orders yet" action={<ButtonLink href="/shop">Start shopping</ButtonLink>} />
        )}
      </div>
    </section>
  );
}
