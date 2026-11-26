import type { Metadata } from "next";
import type { ReactNode } from "react";
import { storeConfig } from "@/config/store";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${storeConfig.name} — Online Fashion Store`,
    template: `%s | ${storeConfig.name}`,
  },
  description: storeConfig.tagline,
};

// The full design system, header and footer arrive in Phase 2.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
