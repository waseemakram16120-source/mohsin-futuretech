import type { ReactNode } from "react";
import { AccountNav } from "@/components/account/AccountNav";
import { getProfile, getSessionUser } from "@/lib/auth/session";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  // Each page calls requireUser() with its own path, so the visitor returns
  // to the exact page after signing in.
  const user = await getSessionUser();
  if (!user) return children;
  const profile = await getProfile();
  const name = profile?.fullName?.split(" ")[0] || user.email;
  return (
    <div className="container-page py-8 sm:py-10">
      <p className="text-sm text-muted">My account</p>
      <h1 className="mt-1 font-display text-4xl font-medium tracking-tight sm:text-5xl">Hi, {name}</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[14rem_1fr] lg:gap-12">
        <aside>
          <AccountNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
