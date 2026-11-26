import { WhatsAppIcon } from "@/components/ui/Icon";

/** Floating "chat on WhatsApp" button (hidden when no number is set). */
export function WhatsAppButton({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp (opens in a new tab)"
      className={[
        "fixed right-4 bottom-4 z-30 inline-flex size-14 items-center justify-center rounded-full bg-whatsapp text-surface shadow-lift",
        "transition-[bottom,scale] duration-200 hover:scale-105 sm:right-6 sm:bottom-6",
        // Lift above the product page's mobile sticky bar while it is shown.
        "in-data-[sticky-bar=true]:bottom-24 sm:in-data-[sticky-bar=true]:bottom-24 lg:in-data-[sticky-bar=true]:bottom-6",
      ].join(" ")}
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
