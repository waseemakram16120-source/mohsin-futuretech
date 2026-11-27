import type { ComponentProps, ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

export const inputClasses = (invalid: boolean) =>
  cn(
    "h-12 w-full rounded-xs border bg-surface px-3.5 text-base placeholder:text-muted sm:text-sm",
    invalid ? "border-sale" : "border-stone-strong focus:border-ink",
  );

/** Label + control + hint/error, wired for screen readers. */
export function Field({
  id,
  label,
  error,
  hint,
  optional,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional ? <span className="font-normal text-muted"> (optional)</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-sm text-sale">
          <Icon name="alert" className="size-3.5 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Text input bound to a Field id (aria-invalid / aria-describedby set). */
export function TextInput({
  id,
  error,
  hint,
  className,
  ...props
}: ComponentProps<"input"> & { id: string; error?: string; hint?: boolean }) {
  return (
    <input
      id={id}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      className={cn(inputClasses(Boolean(error)), className)}
      {...props}
    />
  );
}

export function FormMessage({ tone, children, testId }: { tone: "error" | "success" | "info"; children: ReactNode; testId?: string }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      data-testid={testId}
      className={cn(
        "flex items-start gap-2 rounded-card p-3 text-sm",
        tone === "error" && "bg-sale-soft text-sale",
        tone === "success" && "bg-success-soft text-success",
        tone === "info" && "bg-accent-soft text-accent-strong",
      )}
    >
      <Icon name={tone === "error" ? "alert" : "shield"} className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
