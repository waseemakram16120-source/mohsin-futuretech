import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import LayoutShell from "@/components/LayoutShell";
import { getCategories } from "@/lib/data/store";
import { StoreProvider } from "@/context/StoreContext";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mohsin FutureTech — Online Fashion Store",
  description:
    "Mohsin FutureTech online fashion & clothing store. Browse collections, shop jeans, jackets, shirts and more — COD, EasyPaisa and JazzCash accepted.",
};

// The layout fetches categories from Supabase (via the cookie-based server
// client) on every render, so the whole app must render dynamically.
// Without this, `next build` tries to prerender pages statically and fails
// with "uncached or runtime data during prerendering" as soon as the
// Supabase env vars are set (in demo mode the local fallback has no
// runtime data, so the build passed). See Vercel redeploy failure 2026-11-24.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const categories = await getCategories();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-zinc-900">
        <AuthProvider>
          <StoreProvider>
            <LayoutShell categories={categories}>{children}</LayoutShell>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
