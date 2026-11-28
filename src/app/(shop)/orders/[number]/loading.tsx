import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="container-page py-10">
      <span className="sr-only">Loading your order…</span>
      <Skeleton className="h-52 w-full" />
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
