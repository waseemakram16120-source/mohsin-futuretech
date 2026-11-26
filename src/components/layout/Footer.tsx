import Link from "next/link";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, storeConfig } from "@/config/store";
import { Icon } from "@/components/ui/Icon";
import type { StoreSettings } from "@/lib/catalog/mappers";
import { formatPrice } from "@/lib/format";
import { HELP_LINKS, LEGAL_LINKS, type NavLink } from "./nav";

function LinkList({ title, links }: { title: string; links: NavLink[] }) {
  return (
    <div>
      <h2 className="eyebrow text-surface/60">{title}</h2>
      <ul className="mt-4 space-y-1">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex min-h-9 items-center text-sm text-surface/85 transition-colors hover:text-surface"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer({ settings, shopLinks }: { settings: StoreSettings; shopLinks: NavLink[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-ink text-surface">
      <div className="container-page grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div>
          <p className="font-display text-2xl font-semibold">{settings.storeName}</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-surface/75">{storeConfig.tagline}</p>
          <p className="mt-6 text-sm text-surface/75">
            Free delivery on orders of {formatPrice(settings.freeDeliveryMin)} or more.
          </p>
        </div>

        <LinkList title="Shop" links={shopLinks} />
        <LinkList title="Help" links={HELP_LINKS} />

        <div>
          <h2 className="eyebrow text-surface/60">Contact</h2>
          <ul className="mt-4 space-y-3 text-sm text-surface/85">
            <li className="flex gap-3">
              <Icon name="phone" className="mt-0.5 size-4 shrink-0" />
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="hover:text-surface">
                {settings.phone}
              </a>
            </li>
            <li className="flex gap-3">
              <Icon name="mail" className="mt-0.5 size-4 shrink-0" />
              <a href={`mailto:${settings.email}`} className="break-all hover:text-surface">
                {settings.email}
              </a>
            </li>
            <li className="flex gap-3">
              <Icon name="pin" className="mt-0.5 size-4 shrink-0" />
              <span>{settings.address}</span>
            </li>
          </ul>
          <h2 className="eyebrow mt-8 text-surface/60">We accept</h2>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Payment methods">
            {PAYMENT_METHODS.map((method) => (
              <li
                key={method}
                className="rounded-xs border border-surface/25 px-2.5 py-1 text-xs font-medium text-surface/90"
              >
                {PAYMENT_METHOD_LABELS[method]}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-surface/15">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-surface/65 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {settings.storeName}. All rights reserved.
          </p>
          <ul className="flex gap-5">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-surface">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
