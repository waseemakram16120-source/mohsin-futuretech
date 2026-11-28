"use client";

import { usePathname } from "next/navigation";
import { WhatsAppIcon } from "@/components/ui/Icon";

/** Pages where the floating button would cover form fields (or admin). */
const HIDDEN_ON = ["/checkout", "/admin"];

/** Floating "chat on WhatsApp" button (hidden when no number is set). */
export function WhatsAppButton({ href }: { href: string | null }) {
  const pathname = usePathname();
  if (!href || HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp (opens in a new tab)"
      className={[
        // Sits above the live-chat button (bottom-right).
        "fixed right-4 bottom-20 z-30 inline-flex size-12 items-center justify-center rounded-full bg-whatsapp text-surface shadow-lift",
        "transition-[bottom,scale] duration-200 hover:scale-105 sm:right-7 sm:bottom-[5.5rem]",
        // Lift above the product page's mobile sticky bar while it is shown.
        "in-data-[sticky-bar=true]:bottom-40 sm:in-data-[sticky-bar=true]:bottom-40 lg:in-data-[sticky-bar=true]:bottom-[5.5rem]",
      ].join(" ")}
    >
      <WhatsAppIcon className="size-6" />
    </a>
  );
}
