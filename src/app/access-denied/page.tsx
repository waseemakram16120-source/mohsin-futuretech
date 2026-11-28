import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Access denied", robots: { index: false } };

export default function AccessDeniedPage() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <Icon name="shield" className="size-10 text-muted" />
      <h1 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">Access denied</h1>
      <p className="mt-3 max-w-md text-ink-soft">This area is for store staff only. If you think you should have access, ask the store owner.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Back to the shop</ButtonLink>
        <ButtonLink href="/account" variant="secondary">
          My account
        </ButtonLink>
      </div>
    </div>
  );
}
