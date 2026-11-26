import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminShell from "@/components/AdminShell";

export const metadata: Metadata = {
  title: "Admin Dashboard — Mohsin FutureTech",
  description: "Manage products, orders, payments, customers and reports.",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
