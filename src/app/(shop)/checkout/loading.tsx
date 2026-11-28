import { CartSkeleton } from "@/components/cart/CartView";

export default function Loading() {
  return (
    <div className="container-page py-10">
      <CartSkeleton />
    </div>
  );
}
