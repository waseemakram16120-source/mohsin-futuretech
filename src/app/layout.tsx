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
