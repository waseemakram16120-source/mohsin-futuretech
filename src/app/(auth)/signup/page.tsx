import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/AuthForms";
import { safeNext } from "@/lib/auth/redirect";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  if (await getSessionUser()) redirect(next);
  const loginHref = next === "/account" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
  return (
    <AuthShell
      title="Create account"
      intro="Save your addresses, follow your orders and keep your wishlist on every device."
      footer={
        <>
          Already have an account?{" "}
          <Link href={loginHref} className="font-medium text-ink underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm next={next} />
    </AuthShell>
  );
}
