import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Friendly "nothing here yet" block used by every list. */
export function EmptyState({
  icon = "box",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-stone-strong bg-surface px-6 py-12 text-center">
      <Icon name={icon} className="size-8 text-muted" />
      <h2 className="mt-4 font-display text-xl">{title}</h2>
      {description ? <p className="mt-2 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/** Error block with an optional retry action. */
export function ErrorState({
  title = "Something went wrong",
  description = "Please try again in a moment.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-card border border-sale/30 bg-sale-soft px-6 py-12 text-center">
      <Icon name="alert" className="size-8 text-sale" />
      <h2 className="mt-4 font-display text-xl">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
