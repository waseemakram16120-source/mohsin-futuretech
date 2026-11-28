import { ButtonLink } from "@/components/ui/Button";

export default function ProductNotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="eyebrow text-accent">Product unavailable</p>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-tight">This product is no longer available</h1>
      <p className="mt-4 max-w-md text-ink-soft">It may have sold out or been removed. Explore similar pieces below.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/new-arrivals">New arrivals</ButtonLink>
        <ButtonLink href="/shop" variant="secondary">
          Shop all
        </ButtonLink>
      </div>
    </div>
  );
}
