"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon, WhatsAppIcon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { HELP_LINKS, type NavLink } from "./nav";

/**
 * Off-canvas navigation for small screens. Accessible dialog: focus moves
 * into the panel, Tab is trapped, Esc / backdrop / link click closes it and
 * focus returns to the menu button. Page scroll is locked while open.
 *
 * The drawer is portalled to <body>: the sticky header uses backdrop-filter,
 * which would otherwise become the containing block for `position: fixed`
 * and squeeze the drawer into the header's height.
 */
const noopSubscribe = () => () => {};
export function MobileMenu({
  links,
  storeName,
  whatsappHref,
}: {
  links: NavLink[];
  storeName: string;
  whatsappHref: string | null;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const pathname = usePathname();
  // false during SSR and hydration, true afterwards (portal target exists).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // Close when the route changes (e.g. browser back).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const drawer = (
    <div
      className={cn(
        "fixed inset-0 z-50 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-ink/40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
        className={cn(
          "absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-surface shadow-lift transition-transform duration-300 ease-out-soft",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-stone px-4">
          <p id={titleId} className="font-display text-xl font-semibold">
            {storeName}
          </p>
          <button
            type="button"
            data-autofocus
            className="inline-flex size-11 items-center justify-center rounded-xs hover:bg-sand"
            aria-label="Close menu"
            onClick={close}
          >
            <Icon name="close" className="size-6" />
          </button>
        </div>

        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 py-2">
          <ul>
            {links.map((link) => (
              <li key={link.href} className="border-b border-stone/70">
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-13 items-center justify-between text-base font-medium",
                    link.emphasis === "sale" && "text-sale",
                  )}
                >
                  {link.label}
                  <Icon name="chevronRight" className="size-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="eyebrow mt-8 text-muted">Help</p>
          <ul className="mt-2">
            {HELP_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center text-sm text-ink-soft hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid grid-cols-2 gap-2 border-t border-stone p-4">
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xs border border-stone-strong text-sm font-medium"
          >
            <Icon name="user" className="size-4" /> Account
          </Link>
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xs bg-whatsapp text-sm font-medium text-surface"
            >
              <WhatsAppIcon className="size-4" /> WhatsApp
            </a>
          ) : (
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 items-center justify-center rounded-xs border border-stone-strong text-sm font-medium"
            >
              Contact
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="-ml-2 inline-flex size-11 items-center justify-center rounded-xs hover:bg-sand"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" className="size-6" />
      </button>

      {mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
