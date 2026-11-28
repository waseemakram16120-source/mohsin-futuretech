"use client";

import { useState, type ComponentProps } from "react";
import { inputClasses } from "@/components/forms/Field";
import { cn } from "@/lib/cn";

/** Password field with a Show / Hide toggle (helps on phones). */
export function PasswordInput({ id, error, hint, ...props }: ComponentProps<"input"> & { id: string; error?: string; hint?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(inputClasses(Boolean(error)), "pr-20")}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute inset-y-1 right-1 rounded-xs px-3 text-xs font-medium text-ink-soft hover:bg-sand hover:text-ink"
      >
        {visible ? "Hide" : "Show"}
        <span className="sr-only"> password</span>
      </button>
    </div>
  );
}
