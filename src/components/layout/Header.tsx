import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { CartLink, WishlistLink } from "./HeaderCounts";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import type { NavLink } from "./nav";

export function AnnouncementBar({ freeDeliveryMin }: { freeDeliveryMin: number }) {
  return (
    <div className="bg-ink text-surface">
      <p className="container-page flex h-9 items-center justify-center gap-2 text-center text-xs tracking-wide sm:text-[0.8125rem]">
        <Icon name="truck" className="hidden size-4 sm:block" />
        <span>
          Free delivery on orders of {formatPrice(freeDeliveryMin)} or more
          <span className="hidden sm:inline"> · Cash on Delivery across Pakistan</span>
        </span>
      </p>
    </div>
  );
}

// No display class here: callers add "inline-flex" or "hidden sm:inline-flex"
// so responsive visibility never fights a base display utility.
const iconLink = "size-11 items-center justify-center rounded-xs text-ink transition-colors hover:bg-sand";

export function Header({
  links,
  storeName,
  whatsappHref,
}: {
  links: NavLink[];
  storeName: string;
  whatsappHref: string | null;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/92">
      <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center lg:h-[4.5rem] lg:grid-cols-[auto_1fr_auto] lg:gap-8">
        <div className="flex items-center lg:hidden">
          <MobileMenu links={links} storeName={storeName} whatsappHref={whatsappHref} />
          <Link href="/search" className={cn(iconLink, "inline-flex sm:hidden")} aria-label="Search">
            <Icon name="search" />
          </Link>
        </div>

        <Logo name={storeName} className="justify-self-center lg:justify-self-start" />

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center justify-center gap-x-6 xl:gap-x-7">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "relative py-2 text-[0.8125rem] font-medium uppercase tracking-[0.08em] transition-colors",
                    "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform hover:after:scale-x-100",
                    link.emphasis === "sale" ? "text-sale" : "text-ink-soft hover:text-ink",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center justify-self-end">
          <Link href="/search" className={cn(iconLink, "hidden sm:inline-flex")} aria-label="Search">
            <Icon name="search" />
          </Link>
          <Link href="/account" className={cn(iconLink, "hidden sm:inline-flex")} aria-label="Account">
            <Icon name="user" />
          </Link>
          <WishlistLink className={cn(iconLink, "inline-flex")} />
          <CartLink className={cn(iconLink, "-mr-2 inline-flex sm:mr-0")} />
        </div>
      </div>
    </header>
  );
}
