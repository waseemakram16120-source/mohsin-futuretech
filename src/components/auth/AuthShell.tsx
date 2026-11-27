import type { ReactNode } from "react";

export function AuthShell({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md">
        <h1 className="font-display text-4xl font-medium tracking-tight">{title}</h1>
        {intro ? <p className="mt-3 text-ink-soft">{intro}</p> : null}
        <div className="mt-8 rounded-card border border-stone bg-surface p-5 sm:p-7">{children}</div>
        {footer ? <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div> : null}
      </div>
    </div>
  );
}
