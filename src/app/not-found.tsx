import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="eyebrow text-accent">Error 404</p>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-tight sm:text-5xl">This page took a detour</h1>
      <p className="mt-4 max-w-md text-ink-soft">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved. Try one of our collections instead.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/collections/men">Shop Men</ButtonLink>
        <ButtonLink href="/collections/women" variant="secondary">
          Shop Women
        </ButtonLink>
      </div>
    </div>
  );
}
