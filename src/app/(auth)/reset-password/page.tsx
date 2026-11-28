import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { FormMessage } from "@/components/forms/Field";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  const user = await getSessionUser();
  return (
    <AuthShell title="Choose a new password" intro={user ? `For ${user.email}.` : undefined}>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="space-y-4">
          <FormMessage tone="error">Your reset link has expired or was already used.</FormMessage>
          <Link href="/forgot-password" className="text-sm font-medium underline underline-offset-4">
            Request a new link
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
