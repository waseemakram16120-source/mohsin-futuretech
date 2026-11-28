"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface AdminNavItem {
  href: string;
  label: string;
  badge?: number;
}

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="flex flex-wrap gap-1 lg:flex-col">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center justify-between gap-3 rounded-xs px-4 text-sm font-medium transition-colors",
                  active ? "bg-ink text-surface" : "text-ink-soft hover:bg-sand hover:text-ink",
                )}
              >
                <span>{item.label}</span>
                {item.badge ? (
                  <span
                    className={cn(
                      "min-w-6 rounded-full px-1.5 text-center text-xs font-semibold leading-5",
                      active ? "bg-surface text-ink" : "bg-warning-soft text-warning",
                    )}
                  >
                    {item.badge}
                    <span className="sr-only"> waiting</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
