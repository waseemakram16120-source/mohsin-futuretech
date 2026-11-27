import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "@/components/account/ProfileForm";
import { getProfile, requireUser } from "@/lib/auth/session";
import { formatPkPhone } from "@/lib/checkout/phone";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const profile = await getProfile();
  return (
    <section aria-labelledby="profile-title">
      <h2 id="profile-title" className="font-display text-2xl">
        Profile
      </h2>
      <div className="mt-5">
        <ProfileForm
          name={profile?.fullName ?? ""}
          phone={profile?.phone ? formatPkPhone(profile.phone) : ""}
          email={profile?.email ?? user.email}
        />
      </div>
      <p className="mt-8 text-sm text-ink-soft">
        Want to change your password?{" "}
        <Link href="/forgot-password" className="underline underline-offset-4">
          Send me a reset link
        </Link>
        .
      </p>
    </section>
  );
}
