import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "sale" | "new" | "success" | "warning" | "dark";

const tones: Record<Tone, string> = {
  neutral: "bg-sand text-ink-soft",
  sale: "bg-sale text-surface",
  new: "bg-surface text-ink ring-1 ring-inset ring-stone-strong",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  dark: "bg-ink text-surface",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs px-2 py-0.5 text-[0.6875rem] font-semibold uppercase leading-4 tracking-[0.08em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
