import { ProductCardSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="bg-sand">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div className="space-y-4">
            <Skeleton className="h-4 w-40 bg-stone" />
            <Skeleton className="h-14 w-full max-w-lg bg-stone" />
            <Skeleton className="h-14 w-3/4 bg-stone" />
            <Skeleton className="h-5 w-2/3 bg-stone" />
          </div>
          <Skeleton className="aspect-[4/3] w-full bg-stone" />
        </div>
      </div>
      <div className="container-page mt-16 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
