import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";
import { FormMessage } from "@/components/forms/Field";
import { safeNext } from "@/lib/auth/redirect";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  if (await getSessionUser()) redirect(next);
  const signupHref = next === "/account" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;
  return (
    <AuthShell
      title="Sign in"
      intro={next === "/checkout" ? "Sign in to use your saved addresses — or go back and check out as a guest." : "Track orders, save addresses and keep your wishlist on every device."}
      footer={
        <>
          New here?{" "}
          <Link href={signupHref} className="font-medium text-ink underline underline-offset-4">
            Create an account
          </Link>
          {next === "/checkout" ? (
            <>
              {" "}
              ·{" "}
              <Link href="/checkout?guest=1" className="font-medium text-ink underline underline-offset-4">
                Continue as guest
              </Link>
            </>
          ) : null}
        </>
      }
    >
      {error === "link" ? (
        <div className="mb-5">
          <FormMessage tone="error">That link is invalid or has expired. Please sign in or request a new link.</FormMessage>
        </div>
      ) : null}
      <LoginForm next={next} />
    </AuthShell>
  );
}
