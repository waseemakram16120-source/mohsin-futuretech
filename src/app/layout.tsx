import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { storeConfig } from "@/config/store";
import { AccountSync } from "@/components/auth/AccountSync";
import { Footer } from "@/components/layout/Footer";
import { AnnouncementBar, Header } from "@/components/layout/Header";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { buildPrimaryNav } from "@/components/layout/nav";
import type { Category } from "@/lib/catalog/mappers";
import { getCategories, getStoreSettings } from "@/lib/catalog/queries";
import { enabledPaymentMethods } from "@/lib/payments/registry";
import { whatsappLink } from "@/lib/whatsapp";
import "./globals.css";

const inter = localFont({
  src: "./fonts/inter-latin-wght.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces-latin-wght.woff2", style: "normal" },
    { path: "./fonts/fraunces-latin-wght-italic.woff2", style: "italic" },
  ],
  variable: "--font-fraunces",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: `${storeConfig.name} — Menswear & Womenswear Online in Pakistan`,
    template: `%s | ${storeConfig.name}`,
  },
  description: `${storeConfig.tagline} Jackets, jeans, shirts, trousers and accessories. Cash on Delivery, JazzCash and Easypaisa.`,
  openGraph: { type: "website", siteName: storeConfig.name, locale: "en_PK" },
};

export const viewport: Viewport = {
  themeColor: "#14161a",
};

/** Catalogue pages refresh at most every 60 seconds (see lib/supabase/public). */
export const revalidate = 60;

async function safeCategories(): Promise<Category[]> {
  try {
    return await getCategories();
  } catch (error) {
    // The navigation still works without category links.
    console.error("[layout] categories unavailable", error);
    return [];
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [settings, categories] = await Promise.all([getStoreSettings(), safeCategories()]);
  const nav = buildPrimaryNav(categories);
  const whatsappHref = whatsappLink(settings.whatsapp, `Hi ${settings.storeName}, I have a question.`);

  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-xs focus:bg-ink focus:px-4 focus:py-2 focus:text-surface"
        >
          Skip to content
        </a>
        <AnnouncementBar freeDeliveryMin={settings.freeDeliveryMin} />
        <Header links={nav} storeName={settings.storeName} whatsappHref={whatsappHref} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer settings={settings} shopLinks={nav} paymentMethods={enabledPaymentMethods()} />
        <WhatsAppButton href={whatsappHref} />
        <AccountSync />
      </body>
    </html>
  );
}
