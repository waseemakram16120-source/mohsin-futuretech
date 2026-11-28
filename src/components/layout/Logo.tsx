import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Text wordmark (placeholder until the client supplies a logo — swap the
 * contents of this component for an <Image> of the real logo).
 */
export function Logo({ name, className }: { name: string; className?: string }) {
  const [first, ...rest] = name.split(" ");
  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex min-w-0 flex-col items-center gap-1 leading-none sm:flex-row sm:items-baseline sm:gap-1.5",
        className,
      )}
    >
      <span className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{first}</span>
      {rest.length ? (
        <span className="eyebrow text-[0.5625rem] tracking-[0.28em] text-ink-soft transition-colors group-hover:text-accent sm:text-[0.625rem] sm:tracking-[0.14em]">
          {rest.join(" ")}
        </span>
      ) : null}
    </Link>
  );
}
