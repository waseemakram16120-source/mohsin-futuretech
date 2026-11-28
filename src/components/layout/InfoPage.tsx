import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/listing/ListingPage";
import { policies } from "@/config/policies";

export function InfoPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="container-page py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />
      <h1 className="mt-6 font-display text-4xl font-medium tracking-tight sm:text-5xl">{title}</h1>
      {intro ? <p className="mt-3 max-w-2xl text-ink-soft">{intro}</p> : null}
      {policies.draft ? (
        <p className="mt-4 max-w-2xl rounded-xs border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning" data-testid="policy-draft">
          Draft wording — to be confirmed by the store owner.
        </p>
      ) : null}
      <div className="mt-10 max-w-3xl space-y-10">{children}</div>
    </div>
  );
}

export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}
