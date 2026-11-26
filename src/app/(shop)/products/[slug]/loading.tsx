export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="container-page grid gap-8 py-10 lg:grid-cols-2 lg:gap-14">
      <span className="sr-only">Loading product…</span>
      <div className="aspect-[3/4] animate-pulse rounded-card bg-sand" />
      <div className="space-y-4">
        <div className="h-3 w-24 animate-pulse rounded-xs bg-sand" />
        <div className="h-10 w-3/4 animate-pulse rounded-xs bg-sand" />
        <div className="h-6 w-32 animate-pulse rounded-xs bg-sand" />
        <div className="mt-8 flex gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-12 w-14 animate-pulse rounded-xs bg-sand" />
          ))}
        </div>
        <div className="mt-6 h-13 w-full animate-pulse rounded-xs bg-sand" />
      </div>
    </div>
  );
}
